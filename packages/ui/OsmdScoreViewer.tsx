'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpenSheetMusicDisplay, BackendType } from 'opensheetmusicdisplay'
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Music } from 'lucide-react'
import { cn } from './utils'
import { DEFAULT_BEETHOVEN_5_MUSICXML } from './defaultScoreXml'
import { generateSyntheticMusicXml } from './syntheticMusicXml'

export interface OsmdLoadedScoreInfo {
  title?: string
  composer?: string
  instruments: Array<{ id: string; name: string }>
  totalMeasures: number
}

export interface OsmdScoreViewerProps {
  className?: string
  /** Contenido MusicXML en texto plano */
  musicXml?: string | null
  /** URL para descargar archivo MusicXML o MXL (ej. firmado desde Supabase) */
  musicXmlUrl?: string | null
  /** Título de la obra (para síntesis digital si no hay MusicXML nativo) */
  title?: string | null
  /** Compositor de la obra */
  composer?: string | null
  /** Compás base (ej. '4/4', '3/4') */
  timeSignature?: string | null
  /** Tonalidad (ej. 'C major', 'G minor') */
  keySignature?: string | null
  /** Tempo en BPM */
  tempoBpm?: number | null
  /** Total de compases de la obra */
  totalMeasures?: number | null
  /** Partes o instrumentación configurada */
  parts?: Array<{ name: string; instrumentCode?: string }> | null
  /** Compás activo (1-indexed) sincronizado con el playback */
  activeMeasure?: number | null
  /** Instrumento o voz seleccionada para filtrar el atril (o 'Todos'/'All' para partitura completa) */
  selectedInstrument?: string | null
  /** Nivel de zoom inicial (ej. 1.0) */
  zoom?: number
  /** Si se debe mostrar el cursor musical de playback */
  showCursor?: boolean
  /** Modo oscuro Stand-Ready (por defecto true) */
  darkMode?: boolean
  /** Mostrar barra flotante de zoom/atril */
  showControls?: boolean
  /** Callback al completar la carga y parseo */
  onScoreLoaded?: (info: OsmdLoadedScoreInfo) => void
  /** Callback en caso de error de carga */
  onError?: (err: Error) => void
  /** Etiquetas localizadas */
  labels?: {
    loading?: string
    error?: string
    retry?: string
    zoomIn?: string
    zoomOut?: string
    zoomReset?: string
    allInstruments?: string
    activePart?: string
  }
}

/**
 * Normaliza nombres de instrumentos eliminando tildes, números romanos/arábigos y puntuación
 * para emparejar flexiblemente nombres como "Violín I", "Violin 1", "vln 1", "Violoncello", "Cello".
 */
function normalizeInstrument(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^a-z0-9]/g, '')      // Quita espacios y puntuación
    .replace(/i{1,3}$/, (m) => String(m.length)) // Convierte "i" -> "1", "ii" -> "2", "iii" -> "3"
}

function instrumentsMatch(instName: string, selected: string): boolean {
  const normA = normalizeInstrument(instName)
  const normB = normalizeInstrument(selected)
  if (!normA || !normB) return false
  if (normA === normB) return true
  if (normA.includes(normB) || normB.includes(normA)) return true

  // Alias comunes
  if ((normA.includes('cello') || normA.includes('violoncel')) && (normB.includes('cello') || normB.includes('violoncel'))) return true
  if ((normA.includes('flaut') || normA.includes('flute')) && (normB.includes('flaut') || normB.includes('flute'))) return true
  if ((normA.includes('trompet') || normA.includes('trumpet')) && (normB.includes('trompet') || normB.includes('trumpet'))) return true
  if ((normA.includes('trombon') || normA.includes('trombone')) && (normB.includes('trombon') || normB.includes('trombone'))) return true
  if ((normA.includes('corno') || normA.includes('horn')) && (normB.includes('corno') || normB.includes('horn'))) return true
  if ((normA.includes('clarin') || normA.includes('clarin')) && (normB.includes('clarin') || normB.includes('clarin'))) return true
  if ((normA.includes('contrab') || normA.includes('doublebass')) && (normB.includes('contrab') || normB.includes('doublebass'))) return true
  if ((normA.includes('fagot') || normA.includes('bassoon')) && (normB.includes('fagot') || normB.includes('bassoon'))) return true

  return false
}

export function OsmdScoreViewer({
  className,
  musicXml,
  musicXmlUrl,
  title,
  composer,
  timeSignature,
  keySignature,
  tempoBpm,
  totalMeasures,
  parts,
  activeMeasure,
  selectedInstrument,
  zoom: externalZoom,
  showCursor = true,
  darkMode = true,
  showControls = true,
  onScoreLoaded,
  onError,
  labels,
}: OsmdScoreViewerProps) {
  const uiLabels = {
    loading: labels?.loading ?? 'Cargando notación digital...',
    error: labels?.error ?? 'No se pudo cargar la partitura digital.',
    retry: labels?.retry ?? 'Reintentar',
    zoomIn: labels?.zoomIn ?? 'Aumentar zoom',
    zoomOut: labels?.zoomOut ?? 'Reducir zoom',
    zoomReset: labels?.zoomReset ?? 'Restablecer zoom',
    allInstruments: labels?.allInstruments ?? 'Todos',
    activePart: labels?.activePart ?? 'Parte:',
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const [internalZoom, setInternalZoom] = useState(1.0)
  const currentZoom = externalZoom ?? internalZoom

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedInfo, setLoadedInfo] = useState<OsmdLoadedScoreInfo | null>(null)
  const [cursorMeasure, setCursorMeasure] = useState<number | null>(null)

  // Determinar la fuente de MusicXML: texto directo, URL, síntesis para la obra actual, o muestra por omisión
  const effectiveXmlSource = useMemo(() => {
    if (musicXml && musicXml.trim().length > 0) return { type: 'string', content: musicXml }
    if (musicXmlUrl && musicXmlUrl.trim().length > 0) return { type: 'url', content: musicXmlUrl }
    if ((totalMeasures && totalMeasures > 0) || (title && title.trim().length > 0)) {
      return {
        type: 'string',
        content: generateSyntheticMusicXml({
          title: title || 'Partitura Digital',
          composer: composer || '',
          timeSignature: timeSignature || '4/4',
          keySignature: keySignature || 'C major',
          tempoBpm: tempoBpm || 120,
          totalMeasures: totalMeasures || 32,
          parts:
            parts && parts.length > 0
              ? parts
              : selectedInstrument
                ? [{ name: selectedInstrument }]
                : [{ name: 'Todos' }],
        }),
      }
    }
    return { type: 'string', content: DEFAULT_BEETHOVEN_5_MUSICXML }
  }, [musicXml, musicXmlUrl, title, composer, timeSignature, keySignature, tempoBpm, totalMeasures, parts, selectedInstrument])

  // 1. Inicialización y carga de OSMD
  useEffect(() => {
    let cancelled = false
    const hostEl = containerRef.current
    if (!hostEl) return

    setIsLoading(true)
    setError(null)

    // Limpieza de render previo si existía
    hostEl.innerHTML = ''

    let osmd: OpenSheetMusicDisplay
    try {
      osmd = new OpenSheetMusicDisplay(hostEl, {
        autoResize: true,
        backend: 'svg',
        drawingParameters: 'default',
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
        drawPartNames: true,
        followCursor: true,
      })

      // Reglas de Grabado Stand-Ready (Alto contraste / Modo Oscuro)
      const rules = osmd.EngravingRules
      if (darkMode) {
        rules.PageBackgroundColor = 'transparent'
        rules.StaffLineColor = '#64748b'            // Líneas de pentagrama (slate-500)
        rules.LedgerLineColorDefault = '#94a3b8'     // Líneas adicionales (slate-400)
        rules.DefaultColorMusic = '#f1f5f9'          // Notas, silencios, claves, alteraciones (slate-100)
        rules.DefaultColorNotehead = '#f1f5f9'
        rules.DefaultColorRest = '#f1f5f9'
        rules.DefaultColorStem = '#f1f5f9'
        rules.DefaultColorLabel = '#94a3b8'         // Nombres de instrumentos/partes (slate-400)
        rules.DefaultColorLyrics = '#cbd5e1'        // Letra (slate-300)
        rules.DefaultColorTitle = '#f8fafc'         // Título principal
        rules.DefaultColorCursor = '#f59e0b'        // Cursor ámbar MaestroSync (#f59e0b)
        rules.ColorBeams = true
        rules.ColorFlags = true
        rules.ColorStemsLikeNoteheads = true
      }
      rules.RenderSingleHorizontalStaffline = false
      rules.CompactMode = false
      rules.AutoBeamNotes = true

      osmdRef.current = osmd
    } catch (err: any) {
      console.error('[OsmdScoreViewer] Error inicializando OSMD:', err)
      setError(err?.message || uiLabels.error)
      setIsLoading(false)
      onError?.(err)
      return
    }

    async function loadScore() {
      try {
        if (effectiveXmlSource.type === 'string') {
          await osmd.load(effectiveXmlSource.content)
        } else {
          // Si es URL, descargar o pasar URL directamente
          await osmd.load(effectiveXmlSource.content)
        }

        if (cancelled) return

        // Extraer metadata parseada de la obra
        const sheet = osmd.Sheet
        const instruments = sheet?.Instruments?.map((inst) => ({
          id: String(inst.Id || inst.IdString || ''),
          name: inst.Name || 'Instrumento',
        })) ?? []

        const title = sheet?.Title?.text || sheet?.TitleString || undefined
        const composer = sheet?.Composer?.text || sheet?.ComposerString || undefined
        const totalMeasures = sheet?.SourceMeasures?.length || 1

        const info: OsmdLoadedScoreInfo = {
          title,
          composer,
          instruments,
          totalMeasures,
        }
        setLoadedInfo(info)
        onScoreLoaded?.(info)

        // Aplicar zoom
        osmd.zoom = currentZoom

        // Aplicar filtro de instrumento si fue suministrado
        applyFilter(osmd, selectedInstrument)

        // Render inicial
        osmd.render()

        // Configurar cursor ámbar
        if (osmd.cursor) {
          ;(osmd.cursor as any).cursorOptions = {
            color: '#f59e0b',
            alpha: 0.35,
            type: 0,
            follow: true,
          }

          if (showCursor) {
            osmd.cursor.show()
            styleCursorElement(osmd.cursor.cursorElement)
          } else {
            osmd.cursor.hide()
          }
        }

        setIsLoading(false)
      } catch (err: any) {
        if (cancelled) return
        console.error('[OsmdScoreViewer] Error cargando partitura:', err)
        setError(err?.message || uiLabels.error)
        setIsLoading(false)
        onError?.(err)
      }
    }

    loadScore()

    return () => {
      cancelled = true
      try {
        osmd.clear()
      } catch {
        /* cleanup */
      }
      osmdRef.current = null
    }
  }, [effectiveXmlSource, darkMode])

  // 2. Aplicar filtro de instrumento
  const applyFilter = useCallback((osmd: OpenSheetMusicDisplay, instrumentName?: string | null) => {
    const instruments = osmd.Sheet?.Instruments
    if (!instruments || instruments.length === 0) return

    const isAll =
      !instrumentName ||
      instrumentName === 'Todos' ||
      instrumentName === 'All' ||
      instrumentName.toLowerCase() === 'todos' ||
      instrumentName.toLowerCase() === 'all'

    if (isAll) {
      instruments.forEach((inst) => {
        inst.Visible = true
      })
      return
    }

    let matchFound = false
    instruments.forEach((inst) => {
      const match = instrumentsMatch(inst.Name || '', instrumentName)
      inst.Visible = match
      if (match) matchFound = true
    })

    // Si ningún instrumento coincidió, mantenerlos todos visibles para no dejar en blanco la pantalla
    if (!matchFound) {
      instruments.forEach((inst) => {
        inst.Visible = true
      })
    }
  }, [])

  // 3. Reaccionar a cambios en selectedInstrument
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !osmd.IsReadyToRender()) return

    applyFilter(osmd, selectedInstrument)
    try {
      osmd.render()
      if (osmd.cursor && showCursor) {
        osmd.cursor.show()
        styleCursorElement(osmd.cursor.cursorElement)
      }
    } catch (err) {
      console.warn('[OsmdScoreViewer] Error actualizando filtro de instrumento:', err)
    }
  }, [selectedInstrument, applyFilter, showCursor])

  // 4. Reaccionar a cambios en Zoom
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !osmd.IsReadyToRender()) return

    try {
      osmd.zoom = currentZoom
      osmd.render()
      if (osmd.cursor && showCursor) {
        osmd.cursor.show()
        styleCursorElement(osmd.cursor.cursorElement)
      }
    } catch (err) {
      console.warn('[OsmdScoreViewer] Error aplicando zoom:', err)
    }
  }, [currentZoom, showCursor])

  // 5. Estilización del elemento DOM del cursor (Ámbar Stand-Ready con glow)
  function styleCursorElement(el: HTMLElement | null) {
    if (!el) return
    el.style.backgroundColor = 'rgba(245, 158, 11, 0.4)'
    el.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.7)'
    el.style.borderRadius = '3px'
    el.style.pointerEvents = 'none'
    el.style.zIndex = '15'
    el.style.transition = 'top 0.12s ease-out, left 0.12s ease-out, width 0.12s ease-out'
  }

  // 6. Sincronización milimétrica con activeMeasure (Realtime Playback sin drift)
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || !osmd.IsReadyToRender() || !osmd.cursor || activeMeasure == null) return

    if (!showCursor) {
      osmd.cursor.hide()
      return
    }

    const cursor = osmd.cursor
    // Si el compás no ha cambiado, no repetir el ciclo de búsqueda
    if (cursorMeasure === activeMeasure) return

    try {
      cursor.reset()
      let guard = 0
      while (
        cursor.Iterator &&
        !cursor.Iterator.EndReached &&
        ((cursor.Iterator.CurrentMeasure?.MeasureNumber ?? cursor.Iterator.CurrentMeasureIndex + 1) < activeMeasure) &&
        guard < 3500
      ) {
        guard++
        cursor.nextMeasure()
      }

      cursor.show()
      styleCursorElement(cursor.cursorElement)
      setCursorMeasure(activeMeasure)

      // Auto-scroll suave centrado en el atril cuando el compás avanza
      if (cursor.cursorElement) {
        cursor.cursorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } catch (err) {
      console.warn('[OsmdScoreViewer] Error actualizando cursor al compás:', activeMeasure, err)
    }
  }, [activeMeasure, showCursor, cursorMeasure])

  // 7. Auto-Resize con debounce ante cambios de tamaño o rotación de tablet
  useEffect(() => {
    const hostEl = containerRef.current
    if (!hostEl) return

    let resizeTimer: NodeJS.Timeout
    let lastWidth = hostEl.clientWidth

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.round(entry.contentRect.width)
        if (Math.abs(newWidth - lastWidth) > 15) {
          lastWidth = newWidth
          clearTimeout(resizeTimer)
          resizeTimer = setTimeout(() => {
            const osmd = osmdRef.current
            if (osmd && osmd.IsReadyToRender()) {
              try {
                osmd.render()
                if (osmd.cursor && showCursor) {
                  osmd.cursor.show()
                  styleCursorElement(osmd.cursor.cursorElement)
                }
              } catch (e) {
                console.warn('[OsmdScoreViewer] Error en re-render de redimensión:', e)
              }
            }
          }, 150)
        }
      }
    })

    ro.observe(hostEl)
    return () => {
      clearTimeout(resizeTimer)
      ro.disconnect()
    }
  }, [showCursor])

  const handleZoomChange = (delta: number) => {
    const next = Math.min(2.0, Math.max(0.4, Number((currentZoom + delta).toFixed(2))))
    setInternalZoom(next)
  }

  const handleZoomReset = () => {
    setInternalZoom(1.0)
  }

  return (
    <div
      className={cn(
        'relative w-full h-full flex flex-col select-none overflow-hidden',
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900',
        className
      )}
      style={{
        colorScheme: darkMode ? 'only dark' : 'only light',
      }}
    >
      {/* Barra de herramientas flotante para atril / zoom */}
      {showControls && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-800 shadow-xl">
          {loadedInfo?.instruments && loadedInfo.instruments.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border-r border-slate-800 mr-1">
              <Music className="w-3 h-3" />
              <span>{selectedInstrument || uiLabels.allInstruments}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleZoomChange(-0.15)}
            title={uiLabels.zoomOut}
            aria-label={uiLabels.zoomOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleZoomReset}
            title={uiLabels.zoomReset}
            aria-label={uiLabels.zoomReset}
            className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-colors"
          >
            {Math.round(currentZoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => handleZoomChange(0.15)}
            title={uiLabels.zoomIn}
            aria-label={uiLabels.zoomIn}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Estado de carga */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-950/90 backdrop-blur-sm">
          <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
          <p className="text-sm font-medium text-slate-300">{uiLabels.loading}</p>
        </div>
      )}

      {/* Estado de error */}
      {error && !isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-rose-300 max-w-md">{error}</p>
          <button
            type="button"
            onClick={() => setInternalZoom((z) => z)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{uiLabels.retry}</span>
          </button>
        </div>
      )}

      {/* Contenedor SVG donde OSMD dibuja la partitura */}
      <div
        ref={containerRef}
        data-testid="osmd-svg-container"
        className="w-full h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 flex flex-col items-center scroll-smooth focus:outline-none"
        style={{
          minHeight: '100%',
        }}
      />
    </div>
  )
}
