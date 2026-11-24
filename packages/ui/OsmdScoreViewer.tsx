'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpenSheetMusicDisplay, CursorType } from 'opensheetmusicdisplay'
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Music, FileMusic } from 'lucide-react'
import { cn } from './utils'

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
  /** Modo de dispositivo para zoom responsivo en atril */
  deviceLayout?: 'mobile' | 'tablet' | 'desktop'
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
    noMusicXmlTitle?: string
    noMusicXmlDescription?: string
  }
}

const DEFAULT_ZOOM_BY_LAYOUT: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 0.65,
  tablet: 0.92,
  desktop: 1.0,
}

/**
 * Normaliza nombres de instrumentos eliminando tildes, sufijos de mano/clave (RH/LH, Mano derecha/izquierda),
 * números romanos/arábigos y puntuación para mantener siempre agrupadas las claves (ej. Piano Sol + Fa).
 */
function normalizeInstrument(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(right\s*hand|left\s*hand|mano\s*derecha|mano\s*izquierda|rh|lh|treble|bass|clave\s*de\s*sol|clave\s*de\s*fa)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/i{1,3}$/, (m) => String(m.length))
}

function instrumentsMatch(instName: string, selected: string): boolean {
  const normA = normalizeInstrument(instName)
  const normB = normalizeInstrument(selected)
  if (!normA || !normB) return false
  if (normA === normB) return true
  if (normA.includes(normB) || normB.includes(normA)) return true

  // Alias comunes (incluyendo instrumentos de doble clave Sol + Fa)
  if ((normA.includes('piano') || normA.includes('teclad') || normA.includes('keyboard') || normA.includes('pno')) && (normB.includes('piano') || normB.includes('teclad') || normB.includes('keyboard') || normB.includes('pno'))) return true
  if ((normA.includes('organ') || normA.includes('organo')) && (normB.includes('organ') || normB.includes('organo'))) return true
  if ((normA.includes('harp') || normA.includes('arpa')) && (normB.includes('harp') || normB.includes('arpa'))) return true
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
  deviceLayout = 'tablet',
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
    noMusicXmlTitle: labels?.noMusicXmlTitle ?? 'Notación Digital SVG requiere MusicXML',
    noMusicXmlDescription:
      labels?.noMusicXmlDescription ??
      'Esta obra fue subida como PDF o imagen. Sube un archivo .musicxml o .mxl para verla con OpenSheetMusicDisplay y su cursor nativo.',
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const activeMeasureRef = useRef<number | null>(activeMeasure ?? null)
  const lastCursorTopRef = useRef<number | null>(null)
  const [internalZoom, setInternalZoom] = useState(DEFAULT_ZOOM_BY_LAYOUT[deviceLayout])
  const currentZoom = externalZoom ?? internalZoom

  useEffect(() => {
    activeMeasureRef.current = activeMeasure ?? null
  }, [activeMeasure])

  // Ajustar zoom automáticamente al cambiar entre Móvil / Atril / Escritorio
  useEffect(() => {
    if (externalZoom == null) {
      setInternalZoom(DEFAULT_ZOOM_BY_LAYOUT[deviceLayout])
    }
  }, [deviceLayout, externalZoom])

  const [isLoading, setIsLoading] = useState(false)
  const [isScoreReady, setIsScoreReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedInfo, setLoadedInfo] = useState<OsmdLoadedScoreInfo | null>(null)
  const [cursorMeasure, setCursorMeasure] = useState<number | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  // Solo aceptar MusicXML/MXL real (nunca generar silencios sintéticos ni alterar tonalidad)
  const effectiveXmlSource = useMemo(() => {
    if (musicXml && musicXml.trim().length > 0) return { type: 'string' as const, content: musicXml }
    if (musicXmlUrl && musicXmlUrl.trim().length > 0) return { type: 'url' as const, content: musicXmlUrl }
    return null
  }, [musicXml, musicXmlUrl])

  // Ajuste no intrusivo del elemento DOM del cursor nativo de OSMD (sin alterar su color ni geometría)
  const configureNativeCursorElement = useCallback((el: HTMLElement | null) => {
    if (!el) return
    el.style.pointerEvents = 'none'
    el.style.borderRadius = '4px'
    el.style.transition = 'top 0.12s ease-out, left 0.12s ease-out, width 0.12s ease-out, height 0.12s ease-out'
  }, [])

  // Posicionamiento exacto del cursor nativo de OSMD sobre el compás indicado + auto-scroll solo al cambiar de renglón
  const positionCursorToMeasure = useCallback(
    (osmd: OpenSheetMusicDisplay, targetMeasure: number | null, allowScroll: boolean) => {
      if (!osmd.cursor) return
      if (!showCursor) {
        osmd.cursor.hide()
        return
      }
      const measure = Math.max(1, targetMeasure ?? 1)
      const cursor = osmd.cursor
      try {
        cursor.reset()
        let guard = 0
        while (
          cursor.Iterator &&
          !cursor.Iterator.EndReached &&
          ((cursor.Iterator.CurrentMeasure?.MeasureNumber ?? cursor.Iterator.CurrentMeasureIndex + 1) < measure) &&
          guard < 3500
        ) {
          guard++
          cursor.nextMeasure()
        }
        cursor.show()
        cursor.update()
        configureNativeCursorElement(cursor.cursorElement)

        if (allowScroll && cursor.cursorElement) {
          const top = cursor.cursorElement.offsetTop
          if (lastCursorTopRef.current === null || Math.abs(top - lastCursorTopRef.current) > 12) {
            lastCursorTopRef.current = top
            cursor.cursorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      } catch (err) {
        console.warn('[OsmdScoreViewer] Error posicionando cursor nativo en compás:', measure, err)
      }
    },
    [showCursor, configureNativeCursorElement]
  )

  // Aplicar filtro de instrumento garantizando visibilidad de TODAS las claves (ej. Piano Sol + Fa)
  const applyFilter = useCallback((osmd: OpenSheetMusicDisplay, instrumentName?: string | null) => {
    const instruments = osmd.Sheet?.Instruments
    if (!instruments || instruments.length === 0) return

    const showAllStaves = (inst: any) => {
      inst.Visible = true
      if (Array.isArray(inst.Staves)) {
        inst.Staves.forEach((stave: any) => {
          stave.Visible = true
        })
      }
    }

    const isAll =
      !instrumentName ||
      instrumentName === 'Todos' ||
      instrumentName === 'All' ||
      instrumentName.toLowerCase() === 'todos' ||
      instrumentName.toLowerCase() === 'all'

    if (isAll) {
      instruments.forEach(showAllStaves)
      return
    }

    let matchFound = false
    instruments.forEach((inst) => {
      const match = instrumentsMatch(inst.Name || '', instrumentName)
      if (match) {
        showAllStaves(inst)
        matchFound = true
      } else {
        inst.Visible = false
      }
    })

    // Si ningún instrumento coincidió, mantener todos visibles (con todas sus claves) para no dejar en blanco el atril
    if (!matchFound) {
      instruments.forEach(showAllStaves)
    }
  }, [])

  // 1. Inicialización y carga de OSMD con cursor nativo de compás completo (CurrentArea)
  useEffect(() => {
    let cancelled = false
    const hostEl = containerRef.current
    if (!hostEl) return

    hostEl.innerHTML = ''
    setIsScoreReady(false)
    setCursorMeasure(null)
    lastCursorTopRef.current = null

    if (!effectiveXmlSource) {
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    let osmd: OpenSheetMusicDisplay
    try {
      osmd = new OpenSheetMusicDisplay(hostEl, {
        autoResize: false,
        backend: 'svg',
        drawingParameters: 'default',
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
        drawPartNames: true,
        drawMeasureNumbers: true,
        drawMeasureNumbersOnlyAtSystemStart: false,
        measureNumberInterval: 1,
        followCursor: true,
        autoGenerateMultipleRestMeasuresFromRestMeasures: false,
        newSystemFromXML: true,
        cursorsOptions: [
          {
            type: CursorType.CurrentArea, // Resaltado nativo de compás completo (cubre ambas claves Sol + Fa)
            color: '#f59e0b',             // Ámbar Stand-Ready
            alpha: 0.28,
            follow: true,
          },
        ],
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
        rules.DefaultColorLabel = '#94a3b8'         // Nombres de instrumentos y números de compás
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
      ;(rules as any).AutoGenerateMultipleRestMeasuresFromRestMeasures = false

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
        await osmd.load(effectiveXmlSource!.content)

        if (cancelled) return

        const sheet = osmd.Sheet
        const instruments = sheet?.Instruments?.map((inst) => ({
          id: String(inst.Id || inst.IdString || ''),
          name: inst.Name || 'Instrumento',
        })) ?? []

        const parsedTitle = sheet?.Title?.text || sheet?.TitleString || undefined
        const parsedComposer = sheet?.Composer?.text || sheet?.ComposerString || undefined
        const parsedMeasures = sheet?.SourceMeasures?.length || 1

        const info: OsmdLoadedScoreInfo = {
          title: parsedTitle,
          composer: parsedComposer,
          instruments,
          totalMeasures: parsedMeasures,
        }
        setLoadedInfo(info)
        onScoreLoaded?.(info)

        osmd.zoom = currentZoom
        applyFilter(osmd, selectedInstrument)
        osmd.render()

        positionCursorToMeasure(osmd, activeMeasureRef.current, false)
        setCursorMeasure(activeMeasureRef.current ?? 1)
        setIsScoreReady(true)
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
      setIsScoreReady(false)
    }
  }, [effectiveXmlSource, darkMode, reloadNonce])

  // 2. Reaccionar a cambios en selectedInstrument (preservando el compás activo y todas las claves del instrumento)
  useEffect(() => {
    const osmd = osmdRef.current
    if (!isScoreReady || !osmd || !osmd.IsReadyToRender()) return

    applyFilter(osmd, selectedInstrument)
    try {
      osmd.render()
      positionCursorToMeasure(osmd, activeMeasureRef.current, false)
    } catch (err) {
      console.warn('[OsmdScoreViewer] Error actualizando filtro de instrumento:', err)
    }
  }, [selectedInstrument, applyFilter, isScoreReady, positionCursorToMeasure])

  // 3. Reaccionar a cambios en Zoom (re-anclando cursor nativo tras re-render)
  useEffect(() => {
    const osmd = osmdRef.current
    if (!isScoreReady || !osmd || !osmd.IsReadyToRender()) return

    try {
      osmd.zoom = currentZoom
      osmd.render()
      positionCursorToMeasure(osmd, activeMeasureRef.current, false)
    } catch (err) {
      console.warn('[OsmdScoreViewer] Error aplicando zoom:', err)
    }
  }, [currentZoom, isScoreReady, positionCursorToMeasure])

  // 4. Sincronización milimétrica con activeMeasure usando exclusivamente el cursor nativo de OSMD
  useEffect(() => {
    const osmd = osmdRef.current
    if (!isScoreReady || !osmd || !osmd.IsReadyToRender() || !osmd.cursor || activeMeasure == null) return
    if (cursorMeasure === activeMeasure) return

    positionCursorToMeasure(osmd, activeMeasure, true)
    setCursorMeasure(activeMeasure)
  }, [activeMeasure, cursorMeasure, isScoreReady, positionCursorToMeasure])

  // 5. Auto-Resize con debounce ante cambios de tamaño o rotación de tablet (re-ancla cursor nativo sin descuadre)
  useEffect(() => {
    const hostEl = scrollContainerRef.current
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
                positionCursorToMeasure(osmd, activeMeasureRef.current, false)
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
  }, [positionCursorToMeasure])

  const handleZoomChange = (delta: number) => {
    const next = Math.min(2.0, Math.max(0.4, Number((currentZoom + delta).toFixed(2))))
    setInternalZoom(next)
  }

  const handleZoomReset = () => {
    setInternalZoom(DEFAULT_ZOOM_BY_LAYOUT[deviceLayout])
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
      {showControls && effectiveXmlSource && (
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

      {/* Estado cuando la obra no posee MusicXML/MXL */}
      {!effectiveXmlSource && !isLoading && !error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <FileMusic className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-slate-200 max-w-md">{uiLabels.noMusicXmlTitle}</p>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">{uiLabels.noMusicXmlDescription}</p>
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
            onClick={() => setReloadNonce((n) => n + 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{uiLabels.retry}</span>
          </button>
        </div>
      )}

      {/* Contenedor scrollable externo + host interno `relative` sin padding para anclaje exacto del cursor nativo OSMD */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 scroll-smooth focus:outline-none"
      >
        <div
          ref={containerRef}
          data-testid="osmd-svg-container"
          className="relative w-full min-h-full"
        />
      </div>
    </div>
  )
}
