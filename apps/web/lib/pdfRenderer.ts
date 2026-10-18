'use client'

/**
 * Renderiza una página específica de un documento PDF a un Data URL (PNG)
 * utilizando pdfjs-dist en el navegador, con timeout estricto y fallback seguro.
 */
export async function renderPdfToDataUrl(
  pdfUrl: string,
  pageNumber: number = 1,
  scale: number = 1.5
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (typeof window === 'undefined') return null

  const renderOperation = (async () => {
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')

      // Configurar worker seguro evitando bloqueos cross-origin en localhost
      try {
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          const workerScript = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js');`
          const blob = new Blob([workerScript], { type: 'application/javascript' })
          pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
        }
      } catch {
        // En caso de bloqueo por CSP de Blob workers, pdfjs ejecutará en el hilo principal
      }

      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
      })

      const pdf = await loadingTask.promise
      const safePageNum = Math.min(Math.max(1, pageNumber), pdf.numPages)
      const page = await pdf.getPage(safePageNum)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      await page.render({ canvasContext: ctx, viewport }).promise
      const dataUrl = canvas.toDataURL('image/png')

      return {
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      }
    } catch (err) {
      console.warn('[renderPdfToDataUrl] Error renderizando página PDF:', err)
      return null
    }
  })()

  // Timeout de 5s: garantiza que la carga de la sala nunca se quede bloqueada
  const timeoutPromise = new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
    setTimeout(() => {
      console.warn('[renderPdfToDataUrl] Tiempo límite de 5s superado para renderizar PDF.')
      resolve(null)
    }, 5000)
  })

  return Promise.race([renderOperation, timeoutPromise])
}
