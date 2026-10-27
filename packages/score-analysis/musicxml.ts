import type { ScoreAnalysisResult, DetectedPart, PlaybackJump } from './types'

const FIFTHS_TO_KEY: Record<string, string> = {
  '0_major': 'C major',
  '1_major': 'G major',
  '2_major': 'D major',
  '3_major': 'A major',
  '4_major': 'E major',
  '5_major': 'B major',
  '6_major': 'F# major',
  '-1_major': 'F major',
  '-2_major': 'Bb major',
  '-3_major': 'Eb major',
  '-4_major': 'Ab major',
  '-5_major': 'Db major',
  '-6_major': 'Gb major',
  '0_minor': 'A minor',
  '1_minor': 'E minor',
  '2_minor': 'B minor',
  '3_minor': 'F# minor',
  '4_minor': 'C# minor',
  '-1_minor': 'D minor',
  '-2_minor': 'G minor',
  '-3_minor': 'C minor',
  '-4_minor': 'F minor',
  '-5_minor': 'Bb minor',
}

const INSTRUMENT_NAME_MAP: Record<string, string> = {
  violin: 'violin_1',
  'violin 1': 'violin_1',
  'violin i': 'violin_1',
  'violín 1': 'violin_1',
  'violín i': 'violin_1',
  'violin 2': 'violin_2',
  'violin ii': 'violin_2',
  'violín 2': 'violin_2',
  'violín ii': 'violin_2',
  viola: 'viola',
  violoncello: 'cello',
  cello: 'cello',
  violonchelo: 'cello',
  contrabass: 'contrabass',
  doublebass: 'contrabass',
  'double bass': 'contrabass',
  contrabajo: 'contrabass',
  flute: 'flute',
  flauta: 'flute',
  piccolo: 'piccolo',
  oboe: 'oboe',
  clarinet: 'clarinet',
  clarinete: 'clarinet',
  bassoon: 'bassoon',
  fagot: 'bassoon',
  horn: 'horn',
  'french horn': 'horn',
  corno: 'horn',
  trumpet: 'trumpet',
  trompeta: 'trumpet',
  trombone: 'trombone',
  trombón: 'trombone',
  tuba: 'tuba',
  timpani: 'timpani',
  timbales: 'timpani',
  percussion: 'percussion',
  percusión: 'percussion',
  piano: 'piano',
  harp: 'harp',
  arpa: 'harp',
  guitar: 'guitar',
  guitarra: 'guitar',
}

function matchInstrumentCode(name: string): string | undefined {
  const norm = name.toLowerCase().replace(/[^a-záéíóú0-9 ]/gi, '').trim()
  if (INSTRUMENT_NAME_MAP[norm]) return INSTRUMENT_NAME_MAP[norm]
  for (const [key, code] of Object.entries(INSTRUMENT_NAME_MAP)) {
    if (norm.includes(key)) return code
  }
  return undefined
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml)) !== null) {
    results.push(m[1])
  }
  return results
}

export function parseMusicXml(xmlContent: string): ScoreAnalysisResult {
  const warnings: string[] = []

  // 1. Título
  const workTitle = extractTag(xmlContent, 'work-title')
  const movementTitle = extractTag(xmlContent, 'movement-title')
  const title = workTitle || movementTitle || undefined

  // 2. Compositor
  let composer: string | undefined
  const creatorMatches = xmlContent.match(/<creator\s+type=["']composer["'][^>]*>([\s\S]*?)<\/creator>/i)
  if (creatorMatches) {
    composer = creatorMatches[1].trim()
  }

  // 3. Partes e instrumentos
  const parts: DetectedPart[] = []
  const scoreParts = extractAllTags(xmlContent, 'score-part')
  let partIdx = 0
  for (const sp of scoreParts) {
    const partName = extractTag(sp, 'part-name') || `Parte ${partIdx + 1}`
    const instCode = matchInstrumentCode(partName)
    parts.push({
      name: partName,
      instrumentCode: instCode,
      partOrder: partIdx + 1,
      deskCount: 1,
    })
    partIdx++
  }

  // 4. Medidas, compases, tonalidad y tempo
  let timeSignature = '4/4'
  let keySignature: string | undefined
  let tempoBpm = 120
  const playbackMap: PlaybackJump[] = []

  // Beats y Beat-type
  const beats = extractTag(xmlContent, 'beats')
  const beatType = extractTag(xmlContent, 'beat-type')
  if (beats && beatType) {
    timeSignature = `${beats}/${beatType}`
  }

  // Key (fifths & mode)
  const fifths = extractTag(xmlContent, 'fifths')
  const mode = extractTag(xmlContent, 'mode') || 'major'
  if (fifths !== null) {
    const keyLookup = `${fifths}_${mode.toLowerCase()}`
    keySignature = FIFTHS_TO_KEY[keyLookup] || `${fifths} fifths ${mode}`
  }

  // Tempo
  const soundTempo = xmlContent.match(/<sound[^>]*tempo=["']([0-9.]+)["']/i)
  if (soundTempo) {
    tempoBpm = Math.round(parseFloat(soundTempo[1]))
  }

  // Contar compases dentro de la primera parte
  const firstPartMatch = xmlContent.match(/<part\s+id=["'][^"']+["']>([\s\S]*?)<\/part>/i)
  const partBody = firstPartMatch ? firstPartMatch[1] : xmlContent
  const measureMatches = partBody.match(/<measure\s+number=["'](\d+)["']/gi) || []
  let totalMeasures = measureMatches.length

  // Detección de repeticiones y saltos analizando cada bloque de compás
  // Soporta tanto <measure number="X">...</measure> como <measure number="X"/>
  const measureBlockRegex = /<measure\s+number=["'](\d+)["'](?:>([\s\S]*?)<\/measure>|\s*\/>)/gi
  let m: RegExpExecArray | null
  let repeatStartMeasure = 1

  while ((m = measureBlockRegex.exec(partBody)) !== null) {
    const measureNum = parseInt(m[1], 10)
    const content = m[2] || ''

    if (content.includes('repeat direction="forward"')) {
      repeatStartMeasure = measureNum
    }

    if (content.includes('repeat direction="backward"')) {
      playbackMap.push({
        at: measureNum,
        to: repeatStartMeasure,
        times: 1,
        label: 'repeat',
      })
      repeatStartMeasure = measureNum + 1
    }

    if (content.includes('da-capo') || content.includes('Da Capo') || content.includes('D.C.')) {
      playbackMap.push({
        at: measureNum,
        to: 1,
        times: 1,
        label: 'da_capo',
      })
    }
  }

  if (totalMeasures === 0) {
    totalMeasures = 32
    warnings.push('No se pudieron contar los compases exactos; se asignaron 32 por omisión.')
  }

  // Generar layout sintético para MusicXML
  // Si MusicXML tiene 1 parte, 4 compases por sistema; si tiene N partes, 2-3 compases por sistema
  const measuresPerSystem = parts.length > 2 ? 3 : 4
  const systemsPerPage = parts.length > 2 ? 3 : 5
  const totalSystems = Math.ceil(totalMeasures / measuresPerSystem)
  const totalPages = Math.max(1, Math.ceil(totalSystems / systemsPerPage))

  const pages = []
  let currentMeasure = 1

  for (let p = 1; p <= totalPages; p++) {
    const pageSystems = []
    const startSys = (p - 1) * systemsPerPage
    const endSys = Math.min(totalSystems, p * systemsPerPage)

    for (let s = startSys; s < endSys; s++) {
      const sysOrder = (s % systemsPerPage) + 1
      const count = Math.min(measuresPerSystem, totalMeasures - currentMeasure + 1)
      if (count <= 0) break

      const sysBboxY = 0.08 + (sysOrder - 1) * (0.85 / systemsPerPage)
      const sysBboxH = (0.8 / systemsPerPage) * 0.9

      // Staves dentro de este sistema (1 por parte)
      const staves = parts.map((part, pIdx) => {
        const staffH = sysBboxH / Math.max(1, parts.length)
        const staffY = sysBboxY + pIdx * staffH
        return {
          staffOrder: pIdx + 1,
          bboxX: 0.04,
          bboxY: staffY,
          bboxW: 0.92,
          bboxH: Math.max(0.04, staffH * 0.85),
          partName: part.name,
          instrumentGuess: part.instrumentCode,
          confidence: 1.0,
        }
      })

      // Measures
      const measures = []
      const measureWidth = 0.92 / count
      for (let mIdx = 0; mIdx < count; mIdx++) {
        measures.push({
          measureNumber: currentMeasure + mIdx,
          xStart: 0.04 + mIdx * measureWidth,
          xEnd: 0.04 + (mIdx + 1) * measureWidth,
        })
      }

      pageSystems.push({
        systemOrder: sysOrder,
        measureStart: currentMeasure,
        measureCount: count,
        bboxX: 0.04,
        bboxY: sysBboxY,
        bboxW: 0.92,
        bboxH: sysBboxH,
        staves,
        measures,
        confidence: 1.0,
      })

      currentMeasure += count
    }

    pages.push({
      pageNumber: p,
      systems: pageSystems,
    })
  }

  return {
    title,
    composer,
    keySignature,
    timeSignature,
    tempoBpm,
    totalMeasures,
    pageCount: totalPages,
    parts: parts.length > 0 ? parts : [{ name: 'Todos', partOrder: 1, deskCount: 1 }],
    pages,
    playbackMap,
    confidence: {
      metadata: 0.98,
      layout: 0.95,
    },
    source: 'musicxml',
    warnings,
  }
}
