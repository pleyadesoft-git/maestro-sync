import type { DetectedSystem, DetectedStaff, DetectedMeasure } from './types'

export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array // RGBA or Grayscale
  isRgba?: boolean
}

/**
 * Convierte un buffer de píxeles a array unidimensional de luminosidad normalizada (0=negro, 255=blanco)
 */
function getGrayscale(buf: PixelBuffer): Uint8Array {
  const { width, height, data, isRgba = true } = buf
  const len = width * height
  const gray = new Uint8Array(len)

  if (isRgba) {
    for (let i = 0, p = 0; p < data.length; i++, p += 4) {
      // Perceptual luminance formula: 0.299 R + 0.587 G + 0.114 B
      gray[i] = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2])
    }
  } else {
    gray.set(data.subarray(0, len))
  }
  return gray
}

export interface StaffLineGroup {
  topY: number
  bottomY: number
  lineSpacing: number
  confidence: number
}

/**
 * Detección de pentagramas mediante Proyección Horizontal (HPP)
 */
export function detectStaffLines(buf: PixelBuffer): StaffLineGroup[] {
  const { width, height } = buf
  const gray = getGrayscale(buf)

  // 1. Proyección Horizontal: suma de píxeles oscuros por fila
  const hpp = new Float32Array(height)
  const DARK_THRESHOLD = 160 // Valor menor es más oscuro

  for (let y = 0; y < height; y++) {
    let darkCount = 0
    const rowOffset = y * width
    // Muestreo central (ignora márgenes extremos izquierdo/derecho para evitar sombras del escáner)
    const startX = Math.floor(width * 0.1)
    const endX = Math.floor(width * 0.9)
    for (let x = startX; x < endX; x++) {
      if (gray[rowOffset + x] < DARK_THRESHOLD) {
        darkCount++
      }
    }
    hpp[y] = darkCount / (endX - startX)
  }

  // 2. Encontrar picos locales de líneas horizontales
  const peaks: number[] = []
  const PEAK_THRESHOLD = 0.25 // Al menos 25% de la fila es línea negra

  for (let y = 2; y < height - 2; y++) {
    const val = hpp[y]
    if (val > PEAK_THRESHOLD && val > hpp[y - 1] && val > hpp[y + 1] && val >= hpp[y - 2] && val >= hpp[y + 2]) {
      peaks.push(y)
    }
  }

  // 3. Agrupar picos en quintetos (5 líneas con espaciado uniforme)
  const staves: StaffLineGroup[] = []
  let i = 0

  while (i <= peaks.length - 5) {
    const p0 = peaks[i]
    const p1 = peaks[i + 1]
    const p2 = peaks[i + 2]
    const p3 = peaks[i + 3]
    const p4 = peaks[i + 4]

    const d1 = p1 - p0
    const d2 = p2 - p1
    const d3 = p3 - p2
    const d4 = p4 - p3

    const avgSpacing = (d1 + d2 + d3 + d4) / 4
    const maxDiff = Math.max(
      Math.abs(d1 - avgSpacing),
      Math.abs(d2 - avgSpacing),
      Math.abs(d3 - avgSpacing),
      Math.abs(d4 - avgSpacing)
    )

    // Un pentagrama típico tiene espaciado entre 4px y 30px (según DPI) y variación <= 2px
    if (avgSpacing >= 4 && avgSpacing <= 35 && maxDiff <= Math.max(2, avgSpacing * 0.2)) {
      staves.push({
        topY: p0,
        bottomY: p4,
        lineSpacing: avgSpacing,
        confidence: Math.max(0.6, 1.0 - maxDiff / avgSpacing),
      })
      i += 5 // Avanzar al siguiente grupo
    } else {
      i++ // Probar siguiente pico
    }
  }

  return staves
}

/**
 * Detecta barras de compás dentro de un sistema usando Proyección Vertical (VPP)
 */
export function detectBarLines(
  buf: PixelBuffer,
  staffTopY: number,
  staffBottomY: number,
  startX: number,
  endX: number
): number[] {
  const { width } = buf
  const gray = getGrayscale(buf)
  const staffHeight = staffBottomY - staffTopY
  if (staffHeight <= 0) return []

  const barLines: number[] = []
  const vpp = new Float32Array(endX - startX)
  const DARK_THRESHOLD = 150

  for (let x = startX; x < endX; x++) {
    let darkCount = 0
    for (let y = staffTopY; y <= staffBottomY; y++) {
      if (gray[y * width + x] < DARK_THRESHOLD) {
        darkCount++
      }
    }
    // Proporción de la altura del pentagrama cubierta por línea vertical
    vpp[x - startX] = darkCount / staffHeight
  }

  // Detección de picos verticales continuos (> 70% de la altura del pentagrama)
  const MIN_LINE_FILL = 0.68
  const MIN_BAR_GAP = Math.max(20, staffHeight * 1.5) // Distancia mínima razonable entre compases

  let lastX = -MIN_BAR_GAP
  for (let idx = 1; idx < vpp.length - 1; idx++) {
    const fill = vpp[idx]
    const curX = startX + idx

    if (fill > MIN_LINE_FILL && fill >= vpp[idx - 1] && fill >= vpp[idx + 1]) {
      if (curX - lastX >= MIN_BAR_GAP) {
        barLines.push(curX)
        lastX = curX
      }
    }
  }

  return barLines
}

/**
 * Analiza la imagen de una página y genera los sistemas, pentagramas y compases normalizados
 */
export function analyzePageImage(
  buf: PixelBuffer,
  pageNumber: number,
  startingMeasure = 1,
  defaultMeasuresPerSystem = 4
): { systems: DetectedSystem[]; nextMeasure: number; confidence: number } {
  const { width, height } = buf
  const detectedStaffGroups = detectStaffLines(buf)

  const systems: DetectedSystem[] = []
  let currentMeasure = startingMeasure

  // Si no se detectaron pentagramas con proyección (ej. imagen de baja resolución o página de texto),
  // se genera una cuadrícula estructurada de respaldo
  if (detectedStaffGroups.length === 0) {
    const fallbackSystemCount = 4
    for (let s = 1; s <= fallbackSystemCount; s++) {
      const bboxY = 0.12 + (s - 1) * 0.2
      const bboxH = 0.15
      const measures: DetectedMeasure[] = []
      const measureWidth = 0.92 / defaultMeasuresPerSystem

      for (let m = 0; m < defaultMeasuresPerSystem; m++) {
        measures.push({
          measureNumber: currentMeasure + m,
          xStart: 0.04 + m * measureWidth,
          xEnd: 0.04 + (m + 1) * measureWidth,
        })
      }

      systems.push({
        systemOrder: s,
        measureStart: currentMeasure,
        measureCount: defaultMeasuresPerSystem,
        bboxX: 0.04,
        bboxY,
        bboxW: 0.92,
        bboxH,
        staves: [
          {
            staffOrder: 1,
            bboxX: 0.04,
            bboxY: bboxY + 0.02,
            bboxW: 0.92,
            bboxH: bboxH * 0.8,
            confidence: 0.4,
          },
        ],
        measures,
        confidence: 0.4, // Confianza baja para pedir revisión al usuario
      })

      currentMeasure += defaultMeasuresPerSystem
    }

    return {
      systems,
      nextMeasure: currentMeasure,
      confidence: 0.4,
    }
  }

  // Agrupar pentagramas en sistemas
  // Si la separación entre pentagramas consecutivos es grande (> 3 * lineSpacing * 5), es un nuevo sistema
  const systemsGroups: StaffLineGroup[][] = []
  let currentSystem: StaffLineGroup[] = [detectedStaffGroups[0]]

  for (let k = 1; k < detectedStaffGroups.length; k++) {
    const prev = detectedStaffGroups[k - 1]
    const cur = detectedStaffGroups[k]
    const gap = cur.topY - prev.bottomY
    const thresholdGap = prev.lineSpacing * 9

    if (gap > thresholdGap) {
      systemsGroups.push(currentSystem)
      currentSystem = [cur]
    } else {
      currentSystem.push(cur)
    }
  }
  if (currentSystem.length > 0) {
    systemsGroups.push(currentSystem)
  }

  const startX = Math.floor(width * 0.04)
  const endX = Math.floor(width * 0.96)
  let totalConfidence = 0

  for (let sIdx = 0; sIdx < systemsGroups.length; sIdx++) {
    const staffGroup = systemsGroups[sIdx]
    const firstStaff = staffGroup[0]
    const lastStaff = staffGroup[staffGroup.length - 1]

    // Margen para notas por arriba y por debajo
    const marginY = Math.round(firstStaff.lineSpacing * 2.5)
    const sysTopY = Math.max(0, firstStaff.topY - marginY)
    const sysBottomY = Math.min(height, lastStaff.bottomY + marginY)

    // Bounding box normalizada del sistema
    const bboxX = startX / width
    const bboxY = sysTopY / height
    const bboxW = (endX - startX) / width
    const bboxH = (sysBottomY - sysTopY) / height

    // Staves dentro de este sistema
    const staves: DetectedStaff[] = staffGroup.map((st, idx) => {
      const sTop = Math.max(0, st.topY - st.lineSpacing * 1.5)
      const sBottom = Math.min(height, st.bottomY + st.lineSpacing * 1.5)
      return {
        staffOrder: idx + 1,
        bboxX,
        bboxY: sTop / height,
        bboxW,
        bboxH: (sBottom - sTop) / height,
        confidence: st.confidence,
      }
    })

    // Detectar barras de compás en el primer pentagrama del sistema
    const barXs = detectBarLines(buf, firstStaff.topY, firstStaff.bottomY, startX, endX)
    const measures: DetectedMeasure[] = []
    let measureCount = defaultMeasuresPerSystem

    if (barXs.length >= 2) {
      // Usar barras reales detectadas
      measureCount = barXs.length - 1
      for (let b = 0; b < measureCount; b++) {
        measures.push({
          measureNumber: currentMeasure + b,
          xStart: barXs[b] / width,
          xEnd: barXs[b + 1] / width,
        })
      }
    } else {
      // Fallback a división uniforme si no se detectaron suficientes barras claras
      const mWidth = bboxW / defaultMeasuresPerSystem
      for (let m = 0; m < defaultMeasuresPerSystem; m++) {
        measures.push({
          measureNumber: currentMeasure + m,
          xStart: bboxX + m * mWidth,
          xEnd: bboxX + (m + 1) * mWidth,
        })
      }
    }

    const sysConf = staffGroup.reduce((acc, st) => acc + st.confidence, 0) / staffGroup.length
    totalConfidence += sysConf

    systems.push({
      systemOrder: sIdx + 1,
      measureStart: currentMeasure,
      measureCount,
      bboxX,
      bboxY,
      bboxW,
      bboxH,
      staves,
      measures,
      confidence: sysConf,
    })

    currentMeasure += measureCount
  }

  const avgConfidence = systems.length > 0 ? totalConfidence / systems.length : 0.5

  return {
    systems,
    nextMeasure: currentMeasure,
    confidence: avgConfidence,
  }
}
