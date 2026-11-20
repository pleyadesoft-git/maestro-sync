import {
  listActiveVisionProvidersWithSecrets,
  recordVisionProviderResult,
  resolveProviderBaseUrl,
  type VisionProviderSecretRecord,
} from './vision-providers'

/**
 * Metadata musical enriquecida (visión IA + catálogos abiertos).
 * Todos los campos son opcionales: solo se devuelve lo que se pudo determinar.
 */
export interface EnrichedScoreMetadata {
  title?: string
  composer?: string
  catalogRef?: string
  keySignature?: string
  timeSignature?: string
  tempoBpm?: number
  tempoText?: string
  totalMeasures?: number
  instruments?: string[]
}

export interface EnrichmentAttempt {
  provider: string
  model: string
  ok: boolean
  latencyMs: number
  error?: string
}

export interface EnrichmentResult {
  metadata: EnrichedScoreMetadata
  /** Origen de cada campo: 'vision' | 'musicbrainz' | 'openopus' */
  fieldSources: Partial<Record<keyof EnrichedScoreMetadata, string>>
  visionProviderUsed: string | null
  attempts: EnrichmentAttempt[]
  catalogSourcesUsed: string[]
}

export interface EnrichmentInput {
  /** Imágenes como data URL (data:image/png;base64,...) — página 1 y opcionalmente la última. */
  images: string[]
  /** Pistas ya detectadas localmente (texto del PDF, nombre de archivo). */
  hints?: {
    title?: string
    composer?: string
    fileName?: string
  }
}

const VISION_PROMPT = `You are an expert music engraver reading a sheet music image.
The first image is page 1 of the score; if a second image is provided, it is the LAST page.
Extract ONLY what is printed/visible. Return STRICT JSON (no markdown) with these keys:
{
  "title": string|null,
  "composer": string|null,
  "catalogRef": string|null,        // e.g. "Op. 27 No. 2", "BWV 1007", "K. 525"
  "keySignature": string|null,      // English, e.g. "D major", "F# minor", "Bb major". Infer from key signature accidentals + final chord if needed.
  "timeSignature": string|null,     // e.g. "4/4", "3/4", "6/8". Use "4/4" for C and "2/2" for cut time.
  "tempoText": string|null,         // e.g. "Allegro moderato"
  "tempoBpm": number|null,          // from metronome mark (♩ = 120). If only a tempo word, estimate typical BPM.
  "totalMeasures": number|null,     // the number of the LAST measure on the last page (measure numbers are printed at system starts). Null if unsure.
  "instruments": string[]           // instrument/part names printed at the left of the staves
}`

const IMAGE_MAX_BYTES = 6 * 1024 * 1024
const VISION_TIMEOUT_MS = 30000

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '')
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

function extractJson(text: string): any | null {
  if (!text) return null
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

const KEY_NORMALIZE: Record<string, string> = {
  'a#': 'Bb', 'd#': 'Eb', 'g#': 'Ab', 'gb': 'F#', 'db': 'C#',
}

function normalizeKey(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim()
  const m = /^([A-Ga-g])\s*([#♯b♭]|sharp|flat|-flat|-sharp)?\s*[-\s]*(major|minor|maj|min|mayor|menor|dur|moll)?/i.exec(s)
  if (!m) return undefined
  let note = m[1].toUpperCase()
  const acc = (m[2] || '').toLowerCase()
  if (acc === '#' || acc === '♯' || acc.includes('sharp')) note += '#'
  else if (acc === 'b' || acc === '♭' || acc.includes('flat')) note += 'b'
  const modeRaw = (m[3] || 'major').toLowerCase()
  const mode = /min|menor|moll/.test(modeRaw) ? 'minor' : 'major'
  // Normalizar enarmónicos raros solo en mayor (Bb major es más común que A# major)
  if (mode === 'major' && KEY_NORMALIZE[note.toLowerCase()]) note = KEY_NORMALIZE[note.toLowerCase()]
  return `${note} ${mode}`
}

function normalizeTimeSignature(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim().toUpperCase()
  if (s === 'C') return '4/4'
  if (s === '¢' || s === 'C|') return '2/2'
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(s)
  return m ? `${m[1]}/${m[2]}` : undefined
}

function sanitizeVisionOutput(json: any): EnrichedScoreMetadata {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : undefined)
  const num = (v: unknown, min: number, max: number) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined
  }
  return {
    title: str(json?.title),
    composer: str(json?.composer),
    catalogRef: str(json?.catalogRef),
    keySignature: normalizeKey(json?.keySignature),
    timeSignature: normalizeTimeSignature(json?.timeSignature),
    tempoText: str(json?.tempoText),
    tempoBpm: num(json?.tempoBpm, 20, 320),
    totalMeasures: num(json?.totalMeasures, 1, 5000),
    instruments: Array.isArray(json?.instruments)
      ? json.instruments.filter((i: unknown) => typeof i === 'string' && i.trim()).map((i: string) => i.trim()).slice(0, 40)
      : undefined,
  }
}

async function callGemini(
  p: VisionProviderSecretRecord,
  images: Array<{ mimeType: string; base64: string }>,
  signal: AbortSignal
): Promise<string> {
  const baseUrl = resolveProviderBaseUrl('gemini', p.baseUrl)
  const res = await fetch(
    `${baseUrl}/models/${encodeURIComponent(p.modelName)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: VISION_PROMPT },
              ...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } })),
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 1024 },
      }),
      signal,
    }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 220)}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.map((x: any) => x.text || '').join('') || ''
}

async function callOpenAICompatible(
  p: VisionProviderSecretRecord,
  images: Array<{ mimeType: string; base64: string }>,
  signal: AbortSignal
): Promise<string> {
  const baseUrl = resolveProviderBaseUrl(p.providerType, p.baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${p.apiKey}`,
  }
  if (p.providerType === 'openrouter') {
    headers['HTTP-Referer'] = 'https://maestrosync.app'
    headers['X-Title'] = 'MaestroSync'
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.modelName,
      temperature: 0,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            ...images.map((img) => ({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
            })),
          ],
        },
      ],
    }),
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 220)}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (Array.isArray(content)) return content.map((c: any) => c?.text || '').join('')
  return typeof content === 'string' ? content : ''
}

/**
 * Recorre los proveedores activos en orden de prioridad hasta que uno responda
 * con JSON válido. Registra éxito/fallo de cada intento en la BD.
 */
async function runVisionFailover(images: string[]): Promise<{
  metadata: EnrichedScoreMetadata | null
  providerUsed: string | null
  attempts: EnrichmentAttempt[]
}> {
  const attempts: EnrichmentAttempt[] = []
  const parsed = images
    .map(parseDataUrl)
    .filter((x): x is { mimeType: string; base64: string } => !!x && x.base64.length * 0.75 <= IMAGE_MAX_BYTES)
    .slice(0, 2)

  if (parsed.length === 0) return { metadata: null, providerUsed: null, attempts }

  let providers: VisionProviderSecretRecord[] = []
  try {
    providers = await listActiveVisionProvidersWithSecrets()
  } catch (err) {
    console.warn('[enrich] No se pudieron cargar proveedores de visión:', err)
  }

  for (const p of providers) {
    const startedAt = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)
    try {
      const text =
        p.providerType === 'gemini'
          ? await callGemini(p, parsed, controller.signal)
          : await callOpenAICompatible(p, parsed, controller.signal)

      const json = extractJson(text)
      if (!json) throw new Error('Respuesta sin JSON válido')

      const metadata = sanitizeVisionOutput(json)
      const latencyMs = Date.now() - startedAt
      attempts.push({ provider: p.name, model: p.modelName, ok: true, latencyMs })
      await recordVisionProviderResult(p.id, true, null).catch(() => {})
      return { metadata, providerUsed: p.name, attempts }
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? `Timeout (${VISION_TIMEOUT_MS / 1000}s)` : String(err?.message || err)
      attempts.push({ provider: p.name, model: p.modelName, ok: false, latencyMs: Date.now() - startedAt, error: msg })
      await recordVisionProviderResult(p.id, false, msg).catch(() => {})
      // continuar con el siguiente proveedor
    } finally {
      clearTimeout(timeout)
    }
  }

  return { metadata: null, providerUsed: null, attempts }
}

// ---------------------------------------------------------------------
// Catálogos musicales abiertos (sin API key)
// ---------------------------------------------------------------------

const MB_USER_AGENT = 'MaestroSync/1.0 ( https://maestrosync.app )'

async function fetchJson(url: string, timeoutMs = 8000, headers: Record<string, string> = {}): Promise<any | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

const CATALOG_RE = /\b(Op\.?\s*\d+[a-z]?(?:\s*(?:No\.?|Nr\.?|n\.?)\s*\d+)?|BWV\s*\d+[a-z]?|K\.?\s*\d+[a-z]?|KV\s*\d+[a-z]?|Hob\.?\s*[IVXLC]+[:\/]\s*\d+|D\.?\s*\d{2,4}|RV\s*\d+|HWV\s*\d+|S\.?\s*\d+|WoO\s*\d+)\b/i

function extractCatalogRef(text?: string): string | undefined {
  if (!text) return undefined
  const m = CATALOG_RE.exec(text)
  return m ? m[1].replace(/\s+/g, ' ').trim() : undefined
}

function extractKeyFromTitle(text?: string): string | undefined {
  if (!text) return undefined
  const m = /\bin\s+([A-G])(?:[-\s]?(flat|sharp|b|#))?\s+(major|minor)\b/i.exec(text)
  if (!m) return undefined
  const acc = (m[2] || '').toLowerCase()
  const note = m[1].toUpperCase() + (acc === 'flat' || acc === 'b' ? 'b' : acc === 'sharp' || acc === '#' ? '#' : '')
  return `${note} ${m[3].toLowerCase()}`
}

async function lookupMusicBrainz(title: string, composer?: string): Promise<EnrichedScoreMetadata | null> {
  const q = composer ? `work:"${title}" AND artist:"${composer}"` : `work:"${title}"`
  const data = await fetchJson(
    `https://musicbrainz.org/ws/2/work/?query=${encodeURIComponent(q)}&fmt=json&limit=3`,
    8000,
    { 'User-Agent': MB_USER_AGENT }
  )
  const work = data?.works?.find((w: any) => (w.score ?? 0) >= 85)
  if (!work) return null

  const composerRel = (work.relations || []).find((r: any) => r.type === 'composer')
  const attrKey = (work.attributes || []).find((a: any) => String(a.type).toLowerCase() === 'key')?.value
  const catalogAttr = (work.attributes || []).find((a: any) =>
    /catalog|opus|bwv|köchel|hoboken|deutsch|ryom/i.test(String(a.type))
  )

  return {
    title: work.title,
    composer: composerRel?.artist?.name,
    keySignature: normalizeKey(attrKey) || extractKeyFromTitle(work.title),
    catalogRef: catalogAttr?.value || extractCatalogRef(work.title),
  }
}

async function lookupOpenOpus(title: string, composer?: string): Promise<EnrichedScoreMetadata | null> {
  const term = [composer, title].filter(Boolean).join(' ')
  const data = await fetchJson(`https://api.openopus.org/omnisearch/${encodeURIComponent(term)}/0.json`)
  const hit = (data?.results || []).find((r: any) => r?.work?.title)
  if (!hit) return null
  const workTitle: string = hit.work.title
  return {
    title: workTitle,
    composer: hit.composer?.complete_name || hit.composer?.name,
    catalogRef: extractCatalogRef(workTitle),
    keySignature: extractKeyFromTitle(workTitle),
  }
}

function cleanFileNameHint(fileName?: string): string | undefined {
  if (!fileName) return undefined
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || undefined
}

// ---------------------------------------------------------------------
// Orquestador principal
// ---------------------------------------------------------------------

export async function enrichScoreMetadata(input: EnrichmentInput): Promise<EnrichmentResult> {
  const metadata: EnrichedScoreMetadata = {}
  const fieldSources: EnrichmentResult['fieldSources'] = {}
  const catalogSourcesUsed: string[] = []

  const merge = (src: EnrichedScoreMetadata | null, label: string, overwrite = false) => {
    if (!src) return
    let used = false
    for (const [k, v] of Object.entries(src) as Array<[keyof EnrichedScoreMetadata, any]>) {
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) continue
      if (overwrite || metadata[k] === undefined) {
        ;(metadata as any)[k] = v
        fieldSources[k] = label
        used = true
      }
    }
    if (used && label !== 'vision') catalogSourcesUsed.push(label)
  }

  // 1. Visión IA con failover por prioridad (lo impreso en la partitura manda)
  const vision = await runVisionFailover(input.images || [])
  merge(vision.metadata, 'vision', true)

  // 2. Catálogos abiertos: completar lo que falte (compositor, catálogo, tonalidad original)
  const title = metadata.title || input.hints?.title || cleanFileNameHint(input.hints?.fileName)
  const composer = metadata.composer || input.hints?.composer

  if (title) {
    const [mb, oo] = await Promise.all([
      lookupMusicBrainz(title, composer).catch(() => null),
      lookupOpenOpus(title, composer).catch(() => null),
    ])
    // No sobrescribir lo leído por visión; solo rellenar huecos
    merge(mb, 'musicbrainz')
    merge(oo, 'openopus')
  }

  return {
    metadata,
    fieldSources,
    visionProviderUsed: vision.providerUsed,
    attempts: vision.attempts,
    catalogSourcesUsed,
  }
}
