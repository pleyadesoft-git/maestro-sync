export * from './types'
export * from './musicxml'
export * from './staffDetector'
export * from './metadataDetector'

import type { ScoreAnalysisResult, DetectedPart, DetectedPage } from './types'
import { parseMusicXml } from './musicxml'
import { analyzePageImage, type PixelBuffer } from './staffDetector'
import { detectMetadataFromText, type ExtractedTextItem } from './metadataDetector'

export interface AnalyzeScoreInput {
  fileType: 'pdf' | 'image' | 'musicxml'
  xmlContent?: string
  pagesBuffers?: PixelBuffer[]
  firstPageTextItems?: ExtractedTextItem[]
  pageWidth?: number
  pageHeight?: number
  pageCount?: number
}

/**
 * Pipeline principal de análisis automático de partituras:
 * Integra detección por MusicXML, heurísticas visuales de pentagramas/compases
 * y extracción de metadatos de texto.
 */
export function analyzeScore(input: AnalyzeScoreInput): ScoreAnalysisResult {
  const { fileType, xmlContent, pagesBuffers, firstPageTextItems, pageWidth = 1000, pageHeight = 1400, pageCount = 1 } = input

  // 1. Si es archivo MusicXML, usar análisis exacto
  if (fileType === 'musicxml' && xmlContent) {
    return parseMusicXml(xmlContent)
  }

  // 2. Extraer metadatos de la capa de texto si está disponible
  const textMeta = firstPageTextItems
    ? detectMetadataFromText(firstPageTextItems, pageWidth, pageHeight)
    : { detectedInstrumentNames: [], confidence: 0 }

  // 3. Analizar visualmente cada página
  const detectedPages: DetectedPage[] = []
  let nextMeasure = 1
  let totalLayoutConf = 0

  if (pagesBuffers && pagesBuffers.length > 0) {
    for (let pIdx = 0; pIdx < pagesBuffers.length; pIdx++) {
      const pageResult = analyzePageImage(pagesBuffers[pIdx], pIdx + 1, nextMeasure)
      nextMeasure = pageResult.nextMeasure
      totalLayoutConf += pageResult.confidence

      detectedPages.push({
        pageNumber: pIdx + 1,
        widthPx: pagesBuffers[pIdx].width,
        heightPx: pagesBuffers[pIdx].height,
        systems: pageResult.systems,
      })
    }
  } else {
    // Si no se proporcionaron buffers de píxeles (ej. análisis de sólo metadatos o carga diferida)
    const totalPg = Math.max(1, pageCount)
    for (let p = 1; p <= totalPg; p++) {
      const fallbackResult = analyzePageImage(
        { width: pageWidth, height: pageHeight, data: new Uint8Array(0), isRgba: false },
        p,
        nextMeasure
      )
      nextMeasure = fallbackResult.nextMeasure
      detectedPages.push({
        pageNumber: p,
        widthPx: pageWidth,
        heightPx: pageHeight,
        systems: fallbackResult.systems,
      })
    }
  }

  const avgLayoutConfidence = detectedPages.length > 0
    ? totalLayoutConf / detectedPages.length
    : 0.4

  // Determinar partes / instrumentación
  const parts: DetectedPart[] = []
  if (textMeta.detectedInstrumentNames.length > 0) {
    textMeta.detectedInstrumentNames.forEach((name, idx) => {
      parts.push({
        name,
        partOrder: idx + 1,
        deskCount: 1,
      })
    })
  } else {
    parts.push({
      name: 'Todos',
      partOrder: 1,
      deskCount: 1,
    })
  }

  // Si se detectaron múltiples partes, asociarlas a los pentagramas de los sistemas
  if (parts.length > 1) {
    for (const page of detectedPages) {
      for (const sys of page.systems) {
        sys.staves.forEach((staff, sIdx) => {
          if (parts[sIdx]) {
            staff.partName = parts[sIdx].name
          }
        })
      }
    }
  }

  const totalMeasuresCalculated = Math.max(1, nextMeasure - 1)
  const warnings: string[] = []

  if (textMeta.confidence < 0.5) {
    warnings.push('Verifica el título y compositor detectados.')
  }
  if (avgLayoutConfidence < 0.6) {
    warnings.push('Revisa la alineación de los compases y renglones en el editor visual.')
  }

  return {
    title: textMeta.title,
    composer: textMeta.composer,
    catalogRef: textMeta.catalogRef,
    timeSignature: textMeta.timeSignature || '4/4',
    keySignature: 'C major',
    tempoBpm: textMeta.tempoBpm || 120,
    totalMeasures: totalMeasuresCalculated,
    pageCount: detectedPages.length,
    parts,
    pages: detectedPages,
    playbackMap: [],
    confidence: {
      metadata: textMeta.confidence,
      layout: avgLayoutConfidence,
    },
    source: 'auto',
    warnings,
  }
}
