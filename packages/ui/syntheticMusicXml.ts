/**
 * Generador de partituras MusicXML 3.1 sintéticas y válidas para MaestroSync.
 * Permite que obras subidas como PDF o imagen tengan una representación digital SVG interactiva
 * completa en OpenSheetMusicDisplay con todos los compases, instrumentos y métricas reales.
 */

export interface SyntheticScoreParams {
  title?: string | null
  composer?: string | null
  timeSignature?: string | null // e.g. "4/4", "3/4", "2/4", "6/8"
  keySignature?: string | null // e.g. "C major", "D minor", "G major", etc.
  tempoBpm?: number | null
  totalMeasures?: number | null
  parts?: Array<{ name: string; instrumentCode?: string }> | null
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const KEY_TO_FIFTHS: Record<string, number> = {
  'c major': 0,
  'g major': 1,
  'd major': 2,
  'a major': 3,
  'e major': 4,
  'b major': 5,
  'f# major': 6,
  'f major': -1,
  'bb major': -2,
  'eb major': -3,
  'ab major': -4,
  'db major': -5,
  'gb major': -6,
  'a minor': 0,
  'e minor': 1,
  'b minor': 2,
  'f# minor': 3,
  'c# minor': 4,
  'g# minor': 5,
  'd minor': -1,
  'g minor': -2,
  'c minor': -3,
  'f minor': -4,
  'bb minor': -5,
  'eb minor': -6,
}

export function generateSyntheticMusicXml(params: SyntheticScoreParams): string {
  const title = params.title || 'Obra sin título'
  const composer = params.composer || 'Compositor'
  const timeSignature = params.timeSignature || '4/4'
  const keySignature = params.keySignature || 'C major'
  const tempoBpm = params.tempoBpm && params.tempoBpm > 0 ? params.tempoBpm : 120
  const totalMeasures = Math.max(1, Math.min(9999, params.totalMeasures || 32))
  const rawParts = params.parts
  const [beatsStr, beatTypeStr] = (timeSignature || '4/4').split('/')
  const beats = parseInt(beatsStr, 10) || 4
  const beatType = parseInt(beatTypeStr, 10) || 4
  const divisions = 4
  const measureDuration = Math.round(divisions * (beats * (4 / beatType)))

  const keyNorm = (keySignature || 'c major').trim().toLowerCase()
  const fifths = KEY_TO_FIFTHS[keyNorm] ?? 0
  const mode = keyNorm.includes('minor') ? 'minor' : 'major'

  const effectiveParts =
    rawParts && rawParts.length > 0
      ? rawParts
      : [{ name: 'Todos' }]

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n'
  xml += '<score-partwise version="3.1">\n'
  xml += '  <work>\n'
  xml += `    <work-title>${escapeXml(title)}</work-title>\n`
  xml += '  </work>\n'
  xml += '  <identification>\n'
  xml += `    <creator type="composer">${escapeXml(composer)}</creator>\n`
  xml += '  </identification>\n'
  xml += '  <part-list>\n'

  effectiveParts.forEach((p, idx) => {
    xml += `    <score-part id="P${idx + 1}">\n`
    xml += `      <part-name>${escapeXml(p.name)}</part-name>\n`
    xml += `      <score-instrument id="P${idx + 1}-I1">\n`
    xml += `        <instrument-name>${escapeXml(p.name)}</instrument-name>\n`
    xml += '      </score-instrument>\n'
    xml += '    </score-part>\n'
  })
  xml += '  </part-list>\n'

  effectiveParts.forEach((p, pIdx) => {
    const partId = `P${pIdx + 1}`
    const lower = p.name.toLowerCase()
    const isBass =
      lower.includes('cello') ||
      lower.includes('violonchelo') ||
      lower.includes('bajo') ||
      lower.includes('bass') ||
      lower.includes('tuba') ||
      lower.includes('fagot') ||
      lower.includes('bassoon')
    const clefSign = isBass ? 'F' : 'G'
    const clefLine = isBass ? 4 : 2

    xml += `  <part id="${partId}">\n`

    for (let m = 1; m <= totalMeasures; m++) {
      xml += `    <measure number="${m}">\n`

      if (m === 1) {
        xml += '      <attributes>\n'
        xml += `        <divisions>${divisions}</divisions>\n`
        xml += '        <key>\n'
        xml += `          <fifths>${fifths}</fifths>\n`
        xml += `          <mode>${mode}</mode>\n`
        xml += '        </key>\n'
        xml += '        <time>\n'
        xml += `          <beats>${beats}</beats>\n`
        xml += `          <beat-type>${beatType}</beat-type>\n`
        xml += '        </time>\n'
        xml += '        <clef>\n'
        xml += `          <sign>${clefSign}</sign>\n`
        xml += `          <line>${clefLine}</line>\n`
        xml += '        </clef>\n'
        xml += '      </attributes>\n'
        xml += '      <direction placement="above">\n'
        xml += '        <direction-type>\n'
        xml += '          <metronome>\n'
        xml += '            <beat-unit>quarter</beat-unit>\n'
        xml += `            <per-minute>${tempoBpm}</per-minute>\n`
        xml += '          </metronome>\n'
        xml += '        </direction-type>\n'
        xml += `        <sound tempo="${tempoBpm}"/>\n`
        xml += '      </direction>\n'
      } else if (m % 4 === 1) {
        // Salto de línea / sistema cada 4 compases para un grabado nítido
        xml += '      <print new-system="yes"/>\n'
      }

      xml += '      <note>\n'
      xml += '        <rest/>\n'
      xml += `        <duration>${measureDuration}</duration>\n`
      xml += '        <voice>1</voice>\n'
      xml += '      </note>\n'
      xml += '    </measure>\n'
    }

    xml += '  </part>\n'
  })

  xml += '</score-partwise>\n'
  return xml
}
