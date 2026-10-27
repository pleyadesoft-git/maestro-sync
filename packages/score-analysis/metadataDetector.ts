export interface ExtractedTextItem {
  str: string
  x: number // px or normalized
  y: number
  width?: number
  height?: number
  fontSize?: number
}

export interface DetectedTextMetadata {
  title?: string
  composer?: string
  catalogRef?: string
  tempoText?: string
  tempoBpm?: number
  timeSignature?: string
  detectedInstrumentNames: string[]
  confidence: number
}

const TEMPO_WORD_TO_BPM: Record<string, number> = {
  largo: 50,
  adagio: 66,
  andante: 88,
  moderato: 108,
  allegretto: 116,
  allegro: 132,
  vivace: 156,
  presto: 180,
}

const INSTRUMENT_PATTERNS: Array<{ pattern: RegExp; code: string; label: string }> = [
  { pattern: /\b(viol[ií]n\s*(1|i)\b|vln\.?\s*(1|i)\b)/i, code: 'violin_1', label: 'Violín I' },
  { pattern: /\b(viol[ií]n\s*(2|ii)\b|vln\.?\s*(2|ii)\b)/i, code: 'violin_2', label: 'Violín II' },
  { pattern: /\b(viola|vla\.?)\b/i, code: 'viola', label: 'Viola' },
  { pattern: /\b(violonchelo|violoncello|cello|vcl\.?)\b/i, code: 'cello', label: 'Violonchelo' },
  { pattern: /\b(contrabajo|double\s*bass|contrabass|cb\.?)\b/i, code: 'contrabass', label: 'Contrabajo' },
  { pattern: /\b(flauta|flute|fl\.?)\b/i, code: 'flute', label: 'Flauta' },
  { pattern: /\b(oboe|ob\.?)\b/i, code: 'oboe', label: 'Oboe' },
  { pattern: /\b(clarinete|clarinet|cl\.?)\b/i, code: 'clarinet', label: 'Clarinete' },
  { pattern: /\b(fagot|bassoon|fg\.?)\b/i, code: 'bassoon', label: 'Fagot' },
  { pattern: /\b(trompeta|trumpet|tpt\.?)\b/i, code: 'trumpet', label: 'Trompeta' },
  { pattern: /\b(corno|horn|french\s*horn|hn\.?)\b/i, code: 'horn', label: 'Corno' },
  { pattern: /\b(tromb[oó]n|trombone|tbn\.?)\b/i, code: 'trombone', label: 'Trombón' },
  { pattern: /\b(tuba)\b/i, code: 'tuba', label: 'Tuba' },
  { pattern: /\b(timbales|timpani|timp\.?)\b/i, code: 'timpani', label: 'Timbales' },
  { pattern: /\b(piano|pno\.?)\b/i, code: 'piano', label: 'Piano' },
  { pattern: /\b(soprano)\b/i, code: 'soprano', label: 'Soprano' },
  { pattern: /\b(alto|contralto)\b/i, code: 'alto', label: 'Contralto' },
  { pattern: /\b(tenor)\b/i, code: 'tenor', label: 'Tenor' },
  { pattern: /\b(bajo|bass)\b/i, code: 'bass', label: 'Bajo' },
]

export function detectMetadataFromText(
  items: ExtractedTextItem[],
  pageWidth = 1000,
  pageHeight = 1400
): DetectedTextMetadata {
  if (!items || items.length === 0) {
    return {
      detectedInstrumentNames: [],
      confidence: 0,
    }
  }

  // Filtrar elementos vacíos
  const cleanItems = items
    .map((item) => ({
      ...item,
      str: item.str.trim(),
    }))
    .filter((item) => item.str.length > 0)

  // 1. Título y compositor en la cabecera (primer 25% superior de la página)
  const headerCutoffY = pageHeight * 0.28
  const headerItems = cleanItems.filter((it) => it.y <= headerCutoffY)

  let title: string | undefined
  let composer: string | undefined
  let catalogRef: string | undefined
  let tempoBpm: number | undefined
  let tempoText: string | undefined
  let timeSignature: string | undefined
  const detectedInstruments = new Set<string>()

  // Encontrar el texto con el tamaño de fuente más grande para el título
  let maxFontSize = 0
  let titleCandidate: ExtractedTextItem | null = null

  for (const it of headerItems) {
    const size = it.fontSize || it.height || 12
    // Ignorar números solitarios (ej. página)
    if (/^\d+$/.test(it.str)) continue

    if (size > maxFontSize && it.str.length > 2) {
      maxFontSize = size
      titleCandidate = it
    }

    // Detección de catálogo (BWV, Op., K., Hob.)
    const catMatch = it.str.match(/\b(Op\.?\s*\d+(?:\s*(?:No\.?|n[ºo])\s*\d+)?|BWV\s*\d+|K\.?\s*\d+|Hob\.?\s*[IVXLCDM\d]+|WoO\s*\d+)\b/i)
    if (catMatch && !catalogRef) {
      catalogRef = catMatch[1]
    }

    // Detección de indicación de tempo en cabecera
    for (const [word, bpm] of Object.entries(TEMPO_WORD_TO_BPM)) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(it.str)) {
        tempoText = word.charAt(0).toUpperCase() + word.slice(1)
        tempoBpm = bpm
        break
      }
    }

    // Tempo con indicación metronómica (ej. [quarter note] = 120 o MM = 120)
    const bpmMatch = it.str.match(/(?:(?:[♩|q]|M\.?M\.?)\s*=\s*|tempo\s*[:=]\s*)(\d{2,3})/i)
    if (bpmMatch) {
      tempoBpm = parseInt(bpmMatch[1], 10)
    }
  }

  if (titleCandidate) {
    title = titleCandidate.str
    // Si la siguiente línea cercana tiene tamaño similar, concatenar (ej. títulos en dos líneas)
    const nextLine = headerItems.find(
      (it) =>
        it !== titleCandidate &&
        Math.abs(it.y - titleCandidate!.y) < (titleCandidate!.fontSize || 20) * 1.5 &&
        (it.fontSize || 0) >= maxFontSize * 0.75 &&
        !/op\.|bwv|k\./i.test(it.str)
    )
    if (nextLine && !nextLine.str.toLowerCase().includes(title.toLowerCase())) {
      title = `${title} ${nextLine.str}`
    }
  }

  // Compositor: buscar elemento en el lado derecho de la cabecera (x > 50% del ancho)
  const composerCandidate = headerItems
    .filter((it) => it !== titleCandidate && it.x > pageWidth * 0.45)
    .sort((a, b) => b.y - a.y)[0] // Típicamente debajo del título o en la esquina superior derecha

  if (composerCandidate && composerCandidate.str !== catalogRef) {
    // Filtrar palabras que no son nombres de compositor
    if (!/allegro|andante|adagio|presto|moderato|viol[ií]n|piano|op\.|no\./i.test(composerCandidate.str)) {
      composer = composerCandidate.str
    }
  }

  // 2. Detección de instrumentos en margen izquierdo (x < 25% del ancho)
  const leftMarginItems = cleanItems.filter((it) => it.x <= pageWidth * 0.3)
  for (const it of leftMarginItems) {
    for (const { pattern, label } of INSTRUMENT_PATTERNS) {
      if (pattern.test(it.str)) {
        detectedInstruments.add(label)
      }
    }
  }

  // 3. Detección de Compás (ej. 4/4, 3/4, 2/4, 6/8, 12/8)
  for (const it of cleanItems) {
    const tsMatch = it.str.match(/\b([2346]|12)\s*[\/|\n]\s*([248])\b/)
    if (tsMatch && !timeSignature) {
      timeSignature = `${tsMatch[1]}/${tsMatch[2]}`
      break
    }
  }

  let conf = 0
  if (title) conf += 0.4
  if (composer) conf += 0.3
  if (detectedInstruments.size > 0) conf += 0.2
  if (catalogRef || timeSignature) conf += 0.1

  return {
    title,
    composer,
    catalogRef,
    tempoText,
    tempoBpm,
    timeSignature,
    detectedInstrumentNames: Array.from(detectedInstruments),
    confidence: Math.min(1.0, conf),
  }
}
