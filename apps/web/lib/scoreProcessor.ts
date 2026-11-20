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
function isEnglishLocale(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.lang.toLowerCase().startsWith('en')
  )
}

export async function processScoreFile(
  file: File,
  onProgress?: (stage: string, progress: number) => void
): Promise<ProcessedScoreOutput> {
  const isEn = isEnglishLocale()
  const msg = {
    analyzingXml: isEn ? 'Analyzing MusicXML structure...' : 'Analizando estructura MusicXML...',
    done: isEn ? 'Analysis complete' : 'Análisis completado',
    processingImage: isEn ? 'Processing image...' : 'Procesando imagen...',
    imageLoadError: isEn ? 'Could not load the score image.' : 'No se pudo cargar la imagen de la partitura.',
    canvasError: isEn ? 'Could not initialize image context.' : 'No se pudo inicializar el contexto de imagen.',
    detectingStaves: isEn ? 'Detecting staves and measures...' : 'Detectando pentagramas y compases...',
    initPdf: isEn ? 'Initializing PDF engine...' : 'Inicializando motor PDF...',
    processingPage: (p: number, total: number) =>
      isEn ? `Processing page ${p} of ${total}...` : `Procesando página ${p} de ${total}...`,
    unsupported: isEn
      ? 'Unsupported file format. Use PDF, Image (PNG/JPG), or MusicXML.'
      : 'Formato de archivo no soportado. Usa PDF, Imagen (PNG/JPG) o MusicXML.',
  }

  const fileName = file.name.toLowerCase()
  const isMusicXml = fileName.endsWith('.musicxml') || fileName.endsWith('.xml')
  const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf')
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(fileName)

  // 1. MUSICXML: Análisis exacto y directo
  if (isMusicXml) {
    onProgress?.(msg.analyzingXml, 40)
    const xmlContent = await file.text()
    const analysis = parseMusicXml(xmlContent)
    onProgress?.(msg.done, 100)

    return {
      analysis,
      pageImages: [],
      fileType: 'musicxml',
    }
  }

  // 2. IMAGEN: Renderizado en canvas y extracción visual
  if (isImage) {
    onProgress?.(msg.processingImage, 30)
    const imgUrl = URL.createObjectURL(file)

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(msg.imageLoadError))
      el.src = imgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error(msg.canvasError)

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    URL.revokeObjectURL(imgUrl)

    onProgress?.(msg.detectingStaves, 70)
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

    onProgress?.(msg.done, 100)

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
    onProgress?.(msg.initPdf, 10)
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
      console.warn('Could not extract PDF text:', err)
    }

    // Renderizar las páginas (máximo 8 páginas para análisis rápido en cliente)
    const pagesToAnalyze = Math.min(numPages, 8)
    for (let p = 1; p <= pagesToAnalyze; p++) {
      onProgress?.(msg.processingPage(p, numPages), 20 + Math.floor((p / pagesToAnalyze) * 60))
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

    onProgress?.(msg.detectingStaves, 85)
    const analysis = analyzeScore({
      fileType: 'pdf',
      pagesBuffers,
      firstPageTextItems,
      pageWidth: pageImages[0]?.width || 1000,
      pageHeight: pageImages[0]?.height || 1400,
      pageCount: numPages,
    })

    onProgress?.(msg.done, 100)

    return {
      analysis,
      pageImages,
      fileType: 'pdf',
    }
  }

  throw new Error(msg.unsupported)
}
