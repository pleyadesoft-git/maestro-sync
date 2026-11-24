import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface OmrTranscriptionInput {
  /** Buffer binario del PDF original (preferido: se renderiza a 300 DPI exactos para OMR) */
  pdfBuffer?: Buffer | null
  /** Imágenes de cada página en orden (data:image/png;base64,... o data:image/jpeg;base64,...) */
  images?: string[]
  hints?: {
    title?: string
    composer?: string
    keySignature?: string | null
    timeSignature?: string | null
    tempoBpm?: number | null
    instruments?: string[]
  }
}

export interface OmrTranscriptionResult {
  musicXml: string
  providerUsed: string
  pagesTranscribed: number
  measuresExtracted: number
  detectedFifths: number | null
  warnings: string[]
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function parseDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '')
  if (!m) return null
  return Buffer.from(m[2], 'base64')
}

function resolveUvBinary(bin: 'uv' | 'uvx'): string {
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', bin),
    `/opt/homebrew/bin/${bin}`,
    `/usr/local/bin/${bin}`,
    bin,
  ]
  for (const c of candidates) {
    if (c === bin) return bin
    if (fs.existsSync(c)) return c
  }
  return bin
}

function polishHomrMusicXml(
  rawXml: string,
  hints?: OmrTranscriptionInput['hints']
): { musicXml: string; measuresExtracted: number; detectedFifths: number | null } {
  let xml = rawXml.trim()

  // Reemplazar título si se pasó explícitamente en hints
  if (hints?.title) {
    const safeTitle = escapeXml(hints.title)
    if (/<work-title>[\s\S]*?<\/work-title>/i.test(xml)) {
      xml = xml.replace(/<work-title>[\s\S]*?<\/work-title>/i, `<work-title>${safeTitle}</work-title>`)
    } else if (/<score-partwise[^>]*>/i.test(xml)) {
      xml = xml.replace(/(<score-partwise[^>]*>)/i, `$1<work><work-title>${safeTitle}</work-title></work>`)
    }
  }

  // Inyectar compositor si se pasó en hints y no estaba en <identification>
  if (hints?.composer && !/<creator\s+type=["']composer["']/i.test(xml)) {
    const safeComposer = escapeXml(hints.composer)
    if (/<identification>/i.test(xml)) {
      xml = xml.replace(
        /<identification>/i,
        `<identification><creator type="composer">${safeComposer}</creator>`
      )
    } else if (/<\/work>/i.test(xml)) {
      xml = xml.replace(
        /<\/work>/i,
        `</work><identification><creator type="composer">${safeComposer}</creator></identification>`
      )
    }
  }

  const measureMatches = xml.match(/<measure\b[^>]*>/gi)
  const measuresExtracted = measureMatches ? measureMatches.length : 0

  const fifthsMatch = xml.match(/<fifths>(-?\d+)<\/fifths>/i)
  const detectedFifths = fifthsMatch ? parseInt(fifthsMatch[1], 10) : null

  return { musicXml: xml, measuresExtracted, detectedFifths }
}

/**
 * Transcribe un PDF o conjunto de imágenes de partitura a MusicXML real usando
 * `homr` (motor OMR Deep Learning / TrOmr) con resolución 300 DPI y soporte nativo
 * de Grand Staff (Piano Sol + Fa, Arpa, Órgano) y múltiples páginas.
 */
export async function transcribeScorePagesToMusicXml(
  input: OmrTranscriptionInput
): Promise<OmrTranscriptionResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestrosync-omr-'))
  const warnings: string[] = []
  const uvBin = resolveUvBinary('uv')
  const uvxBin = resolveUvBinary('uvx')

  try {
    const pageFiles: string[] = []

    if (input.pdfBuffer && input.pdfBuffer.length > 0) {
      const pdfPath = path.join(tmpDir, 'input.pdf')
      fs.writeFileSync(pdfPath, input.pdfBuffer)

      // Renderizar todas las páginas del PDF a 300 DPI exactos para máxima precisión OMR
      const pyScript = `
import sys, pypdfium2 as pdfium
pdf = pdfium.PdfDocument(sys.argv[1])
out_dir = sys.argv[2]
max_pages = min(len(pdf), 12)
for i in range(max_pages):
    img = pdf[i].render(scale=300/72).to_pil().convert("RGB")
    img.save(f"{out_dir}/page-{i+1:03d}.png")
print(max_pages)
`.trim()

      const { stdout } = await execFileAsync(
        uvBin,
        ['run', '--with', 'pypdfium2', '--with', 'pillow', 'python3', '-c', pyScript, pdfPath, tmpDir],
        { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
      )
      const count = parseInt(stdout.trim().split('\n').pop() || '0', 10)
      for (let i = 1; i <= count; i++) {
        const fp = path.join(tmpDir, `page-${String(i).padStart(3, '0')}.png`)
        if (fs.existsSync(fp)) pageFiles.push(fp)
      }
    } else if (input.images && input.images.length > 0) {
      const rawPaths: string[] = []
      input.images.slice(0, 12).forEach((dataUrl, idx) => {
        const buf = parseDataUrl(dataUrl)
        if (!buf) return
        const fp = path.join(tmpDir, `raw-${String(idx + 1).padStart(3, '0')}.png`)
        fs.writeFileSync(fp, buf)
        rawPaths.push(fp)
      })

      if (rawPaths.length > 0) {
        // Escalar a ~2480px de ancho si la imagen es menor a 1800px para garantizar interlineado óptimo en homr
        const pyScale = `
import sys
from PIL import Image
for idx, src in enumerate(sys.argv[2:]):
    im = Image.open(src).convert("RGB")
    if im.width < 1800:
        ratio = 2480 / im.width
        im = im.resize((2480, int(im.height * ratio)), Image.Resampling.LANCZOS)
    im.save(f"{sys.argv[1]}/page-{idx+1:03d}.png")
`.trim()

        await execFileAsync(
          uvBin,
          ['run', '--with', 'pillow', 'python3', '-c', pyScale, tmpDir, ...rawPaths],
          { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
        )
        for (let i = 1; i <= rawPaths.length; i++) {
          const fp = path.join(tmpDir, `page-${String(i).padStart(3, '0')}.png`)
          if (fs.existsSync(fp)) pageFiles.push(fp)
        }
      }
    }

    if (pageFiles.length === 0) {
      throw new Error('No se encontraron páginas válidas para transcribir con OMR.')
    }

    // Ejecutar homr sobre todas las páginas juntas (fusiona automáticamente en page-001.musicxml)
    await execFileAsync(
      uvxBin,
      ['--python', '3.12', '--with', 'onnxruntime', 'homr', ...pageFiles],
      { timeout: 240000, maxBuffer: 32 * 1024 * 1024 }
    )

    const mergedXmlPath = pageFiles[0].replace(/\.png$/i, '.musicxml')
    if (!fs.existsSync(mergedXmlPath)) {
      throw new Error('homr finalizó sin generar el archivo MusicXML de salida.')
    }

    const rawXml = fs.readFileSync(mergedXmlPath, 'utf-8')
    const { musicXml, measuresExtracted, detectedFifths } = polishHomrMusicXml(rawXml, input.hints)

    if (measuresExtracted === 0) {
      throw new Error('No se detectaron compases musicales válidos en el documento.')
    }

    return {
      musicXml,
      providerUsed: 'homr-tromr',
      pagesTranscribed: pageFiles.length,
      measuresExtracted,
      detectedFifths,
      warnings,
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore cleanup errors */
    }
  }
}
