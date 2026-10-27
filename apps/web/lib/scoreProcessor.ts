'use client'

import { analyzeScore, parseMusicXml, type ScoreAnalysisResult, type PixelBuffer } from '@music-flow/score-analysis'

export interface ProcessedScoreOutput {
  analysis: ScoreAnalysisResult
  pageImages: Array<{
    pageNumber: number
    dataUrl: string
    width: number
    height: number
  }>
  fileType: 'pdf' | 'image' | 'musicxml'
}

/**
 * Procesa un archivo subido (PDF, Imagen o MusicXML) extrayendo automáticamente
 * su metadata, páginas renderizadas y bounding boxes de pentagramas y compases.
 */
export async function processScoreFile(
  file: File,
  onProgress?: (stage: string, progress: number) => void
): Promise<ProcessedScoreOutput> {
  const fileName = file.name.toLowerCase()
  const isMusicXml = fileName.endsWith('.musicxml') || fileName.endsWith('.xml')
  const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf')
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(fileName)

  // 1. MUSICXML: Análisis exacto y directo
  if (isMusicXml) {
    onProgress?.('Analizando estructura MusicXML...', 40)
    const xmlContent = await file.text()
    const analysis = parseMusicXml(xmlContent)
    onProgress?.('Análisis completado', 100)

    return {
      analysis,
      pageImages: [],
      fileType: 'musicxml',
    }
  }

  // 2. IMAGEN: Renderizado en canvas y extracción visual
  if (isImage) {
    onProgress?.('Procesando imagen...', 30)
    const imgUrl = URL.createObjectURL(file)

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = (e) => reject(new Error('No se pudo cargar la imagen de la partitura.'))
      el.src = imgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('No se pudo inicializar el contexto de imagen.')

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    URL.revokeObjectURL(imgUrl)

    onProgress?.('Detectando pentagramas y compases...', 70)
    const pixelBuf: PixelBuffer = {
      width: canvas.width,
      height: canvas.height,
      data: imageData.data,
      isRgba: true,
    }

    const analysis = analyzeScore({
      fileType: 'image',
      pagesBuffers: [pixelBuf],
      pageWidth: canvas.width,
      pageHeight: canvas.height,
      pageCount: 1,
    })

    onProgress?.('Análisis completado', 100)

    return {
      analysis,
      pageImages: [
        {
          pageNumber: 1,
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        },
      ],
      fileType: 'image',
    }
  }

  // 3. PDF: Renderizado multipágina con pdfjs-dist y detección heurística
  if (isPdf) {
    onProgress?.('Inicializando motor PDF...', 10)
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')

    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        const workerScript = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js');`
        const blob = new Blob([workerScript], { type: 'application/javascript' })
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
      }
    } catch {
      /* fallback al hilo principal */
    }

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    })

    const pdf = await loadingTask.promise
    const numPages = pdf.numPages
    const pageImages: Array<{ pageNumber: number; dataUrl: string; width: number; height: number }> = []
    const pagesBuffers: PixelBuffer[] = []
    let firstPageTextItems: any[] = []

    // Extraer texto de la primera página para título, compositor y metadatos
    try {
      const firstPage = await pdf.getPage(1)
      const textContent = await firstPage.getTextContent()
      const viewport = firstPage.getViewport({ scale: 1.0 })

      firstPageTextItems = textContent.items.map((it: any) => {
        // En PDF.js la transformación [scaleX, skewY, skewX, scaleY, transformX, transformY]
        const tx = it.transform ? it.transform[4] : 0
        const ty = it.transform ? viewport.height - it.transform[5] : 0
        const fontSize = it.transform ? Math.abs(it.transform[0] || it.transform[3] || 12) : 12
        return {
          str: it.str || '',
          x: tx,
          y: ty,
          width: it.width,
          height: it.height || fontSize,
          fontSize,
        }
      })
    } catch (err) {
      console.warn('No se pudo extraer texto del PDF:', err)
    }

    // Renderizar las páginas (máximo 8 páginas para análisis rápido en cliente)
    const pagesToAnalyze = Math.min(numPages, 8)
    for (let p = 1; p <= pagesToAnalyze; p++) {
      onProgress?.(`Procesando página ${p} de ${numPages}...`, 20 + Math.floor((p / pagesToAnalyze) * 60))
      const page = await pdf.getPage(p)
      const viewport = page.getViewport({ scale: 1.5 })

      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise
        const dataUrl = canvas.toDataURL('image/png')
        pageImages.push({
          pageNumber: p,
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        })

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        pagesBuffers.push({
          width: canvas.width,
          height: canvas.height,
          data: imgData.data,
          isRgba: true,
        })
      }
    }

    onProgress?.('Detectando pentagramas y compases...', 85)
    const analysis = analyzeScore({
      fileType: 'pdf',
      pagesBuffers,
      firstPageTextItems,
      pageWidth: pageImages[0]?.width || 1000,
      pageHeight: pageImages[0]?.height || 1400,
      pageCount: numPages,
    })

    onProgress?.('Análisis completado', 100)

    return {
      analysis,
      pageImages,
      fileType: 'pdf',
    }
  }

  throw new Error('Formato de archivo no soportado. Usa PDF, Imagen (PNG/JPG) o MusicXML.')
}
