'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { cn } from './utils'
import { HighlightOverlay } from './HighlightOverlay'
import { MeasureIndicator, type MeasureIndicatorStyle } from './MeasureIndicator'
import { OsmdScoreViewer } from './OsmdScoreViewer'

export interface ScorePageData {
  id: string
  pageNumber: number
  imageUrl?: string | null
  widthPx?: number | null
  heightPx?: number | null
}

export interface ScoreSystemData {
  id: string
  scorePageId?: string
  pageNumber?: number
  measureStart: number
  measureCount: number
  bboxX: number
  bboxY: number
  bboxW: number
  bboxH: number
  instrument: string
}

export interface MusicScoreSheetLabels {
  facsimile?: string
  digitalSvg?: string
  activePart?: string
  loadingScore?: string
  prevPageAria?: string
  nextPageAria?: string
  pageShort?: string
  showingSvg?: string
  measureWord?: string
  measurePrefix?: string
  pageWord?: string
  requiresMusicXml?: string
}

export interface MusicScoreSheetProps {
  className?: string
  title?: string
  composer?: string
  subtitle?: string
  tempoText?: string
  timeSignature?: string
  keySignature?: string | null
  tempoBpm?: number
  totalMeasures?: number | null
  parts?: Array<{ name: string; instrumentCode?: string }>
  activeSystemIndex?: number
  activeMeasure?: number
  selectedInstrument?: string
  highlightLabel?: string
  pages?: ScorePageData[]
  systems?: ScoreSystemData[]
  activePageNumber?: number
  onPageChange?: (pageNumber: number) => void
  viewMode?: 'facsimile' | 'digital'
  onViewModeChange?: (mode: 'facsimile' | 'digital') => void
  deviceLayout?: 'mobile' | 'tablet' | 'desktop'
  measureIndicatorStyle?: MeasureIndicatorStyle | 'none'
  labels?: MusicScoreSheetLabels
  musicXml?: string | null
  musicXmlUrl?: string | null
}

interface NormalizedBBox {
  bboxX: number
  bboxY: number
  bboxW: number
  bboxH: number
}

/**
 * Staff lines live at y=25–65 of a 100-unit SVG viewBox stretched to the row.
 * Inset the glow so it sits on the pentagram (not the title chrome) on any viewport.
 */
function staffCenteredBox(row: DOMRect, host: DOMRect): NormalizedBBox {
  const insetY = row.height * 0.08
  const insetX = row.width * 0.012
  const top = row.top + insetY
  const left = row.left + insetX
  const height = Math.max(row.height - insetY * 2, 1)
  const width = Math.max(row.width - insetX * 2, 1)

  return {
    bboxX: (left - host.left) / host.width,
    bboxY: (top - host.top) / host.height,
    bboxW: width / host.width,
    bboxH: height / host.height,
  }
}

export function MusicScoreSheet({
  className,
  title = '',
  composer = '',
  subtitle = '',
  tempoText,
  timeSignature = '4/4',
  keySignature,
  tempoBpm,
  totalMeasures,
  parts,
  activeSystemIndex,
  activeMeasure,
  selectedInstrument,
  highlightLabel,
  pages,
  systems,
  activePageNumber,
  onPageChange,
  viewMode: propViewMode,
  onViewModeChange,
  deviceLayout = 'tablet',
  measureIndicatorStyle = 'subtle',
  labels,
  musicXml,
  musicXmlUrl,
}: MusicScoreSheetProps) {
  const uiLabels = {
    facsimile: labels?.facsimile ?? 'Facsímil',
    digitalSvg: labels?.digitalSvg ?? 'Digital SVG',
    activePart: labels?.activePart ?? 'Parte activa:',
    loadingScore: labels?.loadingScore ?? 'Cargando partitura...',
    prevPageAria: labels?.prevPageAria ?? 'Página anterior',
    nextPageAria: labels?.nextPageAria ?? 'Página siguiente',
    pageShort: labels?.pageShort ?? 'Pág.',
    showingSvg: labels?.showingSvg ?? 'Mostrando notación digital SVG interactiva',
    measureWord: labels?.measureWord ?? 'Compás',
    measurePrefix: labels?.measurePrefix ?? 'c.',
    pageWord: labels?.pageWord ?? 'Página',
    requiresMusicXml: labels?.requiresMusicXml ?? 'Requiere archivo MusicXML (.musicxml / .mxl)',
  }
  const stavesHostRef = useRef<HTMLDivElement>(null)
  const systemElsRef = useRef<Array<HTMLDivElement | null>>([])
  const [highlightBox, setHighlightBox] = useState<NormalizedBBox | null>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)

  const hasRealPages = Boolean(pages && pages.length > 0 && pages.some((p) => Boolean(p.imageUrl)))
  const hasMusicXml = Boolean(
    (musicXml && musicXml.trim().length > 0) || (musicXmlUrl && musicXmlUrl.trim().length > 0)
  )

  const [internalViewMode, setInternalViewMode] = useState<'facsimile' | 'digital'>(
    hasMusicXml ? 'digital' : hasRealPages ? 'facsimile' : 'digital'
  )

  // Sincronizar el modo por defecto cuando llegan asíncronamente las páginas PDF o el archivo MusicXML
  useEffect(() => {
    if (propViewMode) return
    if (hasMusicXml) {
      setInternalViewMode('digital')
      onViewModeChange?.('digital')
    } else if (hasRealPages) {
      setInternalViewMode('facsimile')
      onViewModeChange?.('facsimile')
    }
  }, [hasMusicXml, hasRealPages, propViewMode])

  const currentViewMode = propViewMode ?? internalViewMode
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  const effectiveTempoLabel = tempoText || (tempoBpm && tempoBpm > 0 ? `♩ = ${tempoBpm}` : null)

  const [internalPageNumber, setInternalPageNumber] = useState(1)
  const realCurrentPageNumber = activePageNumber ?? internalPageNumber
  const currentPage = pages?.find((p) => p.pageNumber === realCurrentPageNumber) ?? pages?.[0]

  useEffect(() => {
    setImageLoading(true)
    setImageError(false)

    // Timeout de seguridad si la imagen de la partitura tarda más de 6s
    const timer = setTimeout(() => {
      setImageLoading((prev) => {
        if (prev) {
          console.warn('[MusicScoreSheet] Timeout al cargar imagen de partitura.')
          setImageError(true)
          return false
        }
        return false
      })
    }, 6000)

    return () => clearTimeout(timer)
  }, [currentPage?.imageUrl])

  const canShowRealPages = Boolean(
    hasRealPages &&
    currentPage?.imageUrl &&
    !imageError &&
    (currentViewMode === 'facsimile' || !hasMusicXml)
  )

  const handlePageChange = (newPage: number) => {
    if (!pages || newPage < 1 || newPage > pages.length) return
    setInternalPageNumber(newPage)
    onPageChange?.(newPage)
  }

  // Active system from real systems list if provided
  const activeRealSystem =
    systems && activeSystemIndex != null && activeSystemIndex >= 0 && activeSystemIndex < systems.length
      ? systems[activeSystemIndex]
      : null

  // Ensure active system belongs to the current page if multi-page
  const isSystemOnCurrentPage =
    !activeRealSystem ||
    activeRealSystem.pageNumber == null ||
    activeRealSystem.pageNumber === currentPage?.pageNumber ||
    (currentPage && activeRealSystem.scorePageId === currentPage.id)

  const activeSystemOnCurrentPage = isSystemOnCurrentPage ? activeRealSystem : null

  // Cálculo de caja del compás discreto dentro del pentagrama / sistema
  const activeMeasureBox = useMemo(() => {
    if (!activeSystemOnCurrentPage || activeMeasure == null) return null
    const { measureStart, measureCount, bboxX, bboxY, bboxW, bboxH } = activeSystemOnCurrentPage
    const safeCount = Math.max(1, measureCount)
    if (activeMeasure < measureStart || activeMeasure >= measureStart + safeCount) {
      return null
    }
    const offset = activeMeasure - measureStart
    const widthPerMeasure = bboxW / safeCount
    return {
      bboxX: bboxX + offset * widthPerMeasure,
      bboxY,
      bboxW: widthPerMeasure,
      bboxH,
    }
  }, [activeSystemOnCurrentPage, activeMeasure])

  useEffect(() => {
    if (pageContainerRef.current) {
      pageContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSystemIndex, realCurrentPageNumber])

  const registerSystem = useCallback((index: number, el: HTMLDivElement | null) => {
    systemElsRef.current[index] = el
  }, [])

  const measureActiveStaff = useCallback(() => {
    const host = stavesHostRef.current
    if (!host || activeSystemIndex == null) {
      setHighlightBox(null)
      return
    }

    const row = systemElsRef.current[activeSystemIndex]
    if (!row) {
      setHighlightBox(null)
      return
    }

    const hostRect = host.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    if (hostRect.width < 1 || hostRect.height < 1) return

    const nextBox = staffCenteredBox(rowRect, hostRect)
    setHighlightBox((prev) => {
      if (
        prev &&
        Math.abs(prev.bboxX - nextBox.bboxX) < 0.001 &&
        Math.abs(prev.bboxY - nextBox.bboxY) < 0.001 &&
        Math.abs(prev.bboxW - nextBox.bboxW) < 0.001 &&
        Math.abs(prev.bboxH - nextBox.bboxH) < 0.001
      ) {
        return prev
      }
      return nextBox
    })
  }, [activeSystemIndex])

  useEffect(() => {
    measureActiveStaff()

    const host = stavesHostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return

    let rafId: number | null = null
    const scheduleMeasure = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        measureActiveStaff()
      })
    }

    const observer = new ResizeObserver(() => scheduleMeasure())
    observer.observe(host)
    systemElsRef.current.forEach((el) => {
      if (el) observer.observe(el)
    })

    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('orientationchange', scheduleMeasure)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('orientationchange', scheduleMeasure)
    }
  }, [measureActiveStaff])

  const overlayLabel =
    highlightLabel ??
    (selectedInstrument && activeSystemIndex != null
      ? `${selectedInstrument} — ${uiLabels.measureWord} ${activeMeasure ?? 1}`
      : undefined)

  return (
    <div
      className={cn(
        'w-full h-full flex flex-col select-none relative overflow-hidden text-slate-200',
        className
      )}
    >
      {/* Score Header — compact on mobile so it never steals the overlay coordinate space */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between pb-2 sm:pb-3 border-b border-slate-800/80 mb-1 sm:mb-2 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
            <h2 className="text-sm sm:text-lg font-serif font-bold tracking-tight text-slate-100 truncate">
              {title}
            </h2>
            <span className="text-[11px] sm:text-xs font-serif italic text-amber-400/90 font-medium">
              {subtitle}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-serif truncate">
            {composer} • {timeSignature}
          </p>
        </div>

        <div className="flex flex-wrap items-center sm:items-end justify-between sm:justify-end gap-2 shrink-0">
          {hasRealPages && (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => {
                  setInternalViewMode('facsimile')
                  onViewModeChange?.('facsimile')
                }}
                disabled={imageError}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] sm:text-xs',
                  canShowRealPages
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed'
                )}
              >
                {uiLabels.facsimile}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hasMusicXml) return
                  setInternalViewMode('digital')
                  onViewModeChange?.('digital')
                }}
                disabled={!hasMusicXml}
                title={!hasMusicXml ? uiLabels.requiresMusicXml : undefined}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] sm:text-xs',
                  !canShowRealPages && hasMusicXml
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed'
                )}
              >
                {uiLabels.digitalSvg}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {effectiveTempoLabel && (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px]">
                <span className="font-serif italic font-semibold text-amber-400">{effectiveTempoLabel}</span>
              </div>
            )}
            {selectedInstrument && (
              <span className="text-[10px] text-slate-400 font-mono">
                {uiLabels.activePart} <strong className="text-amber-400">{selectedInstrument}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {canShowRealPages ? (
        <div className="flex-1 min-h-0 w-full relative flex flex-col items-center justify-center overflow-auto p-2 sm:p-4">
          <div
            ref={pageContainerRef}
            className="relative inline-block max-w-full shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white transition-transform duration-300"
            style={{
              minHeight: imageLoading ? 420 : undefined,
              minWidth: imageLoading ? 300 : undefined,
              transform:
                deviceLayout === 'mobile' && activeSystemOnCurrentPage
                  ? 'scale(1.35)'
                  : undefined,
              transformOrigin:
                deviceLayout === 'mobile' && activeSystemOnCurrentPage
                  ? `50% ${Math.min(90, Math.max(10, activeSystemOnCurrentPage.bboxY * 100))}%`
                  : 'center top',
            }}
          >
            {imageLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-amber-400 z-10 p-4">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs font-mono text-slate-300">{uiLabels.loadingScore}</span>
              </div>
            )}

            {/* Real score page rendering */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPage?.imageUrl || ''}
              alt={`${title} - ${uiLabels.pageWord} ${currentPage?.pageNumber ?? 1}`}
              onLoad={(e) => {
                setImageLoading(false)
                const img = e.currentTarget
                if (img.naturalWidth <= 10 || img.naturalHeight <= 10) {
                  setImageError(true)
                }
              }}
              onError={() => {
                setImageLoading(false)
                setImageError(true)
              }}
              className={cn(
                'block max-w-full max-h-[calc(100vh-220px)] object-contain select-none pointer-events-none transition-opacity duration-200',
                imageLoading ? 'opacity-0' : 'opacity-100'
              )}
            />
            {!imageLoading && activeSystemOnCurrentPage && (
              <>
                <HighlightOverlay
                  bboxX={activeSystemOnCurrentPage.bboxX}
                  bboxY={activeSystemOnCurrentPage.bboxY}
                  bboxW={activeSystemOnCurrentPage.bboxW}
                  bboxH={activeSystemOnCurrentPage.bboxH}
                  label={overlayLabel}
                />
                {measureIndicatorStyle !== 'none' && activeMeasureBox && (
                  <MeasureIndicator
                    bboxX={activeMeasureBox.bboxX}
                    bboxY={activeMeasureBox.bboxY}
                    bboxW={activeMeasureBox.bboxW}
                    bboxH={activeMeasureBox.bboxH}
                    measureNumber={activeMeasure ?? activeSystemOnCurrentPage.measureStart}
                    measurePrefix={uiLabels.measurePrefix}
                    style={measureIndicatorStyle}
                  />
                )}
              </>
            )}
          </div>

          {pages && pages.length > 1 && (
            <div className="mt-3 flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-xs text-slate-300 shadow-md shrink-0">
              <button
                type="button"
                onClick={() => handlePageChange(realCurrentPageNumber - 1)}
                disabled={realCurrentPageNumber <= 1}
                aria-label={uiLabels.prevPageAria}
                className="p-1 rounded-full hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-amber-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs">
                {uiLabels.pageShort} <strong className="text-amber-400">{realCurrentPageNumber}</strong> / {pages.length}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(realCurrentPageNumber + 1)}
                disabled={realCurrentPageNumber >= pages.length}
                aria-label={uiLabels.nextPageAria}
                className="p-1 rounded-full hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-amber-400 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Notación Digital Interactiva con OpenSheetMusicDisplay */
        <div
          ref={stavesHostRef}
          className="flex-1 min-h-0 w-full relative flex flex-col justify-around py-1"
        >
          {imageError && hasRealPages && (
            <div className="mx-auto mb-1 inline-flex items-center gap-2 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full text-[11px] text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{uiLabels.showingSvg}</span>
            </div>
          )}

          <OsmdScoreViewer
            className="flex-1 w-full min-h-[440px]"
            musicXml={musicXml}
            musicXmlUrl={musicXmlUrl}
            title={title}
            composer={composer}
            timeSignature={timeSignature}
            keySignature={keySignature}
            tempoBpm={tempoBpm}
            totalMeasures={
              totalMeasures ||
              (systems && systems.length > 0
                ? Math.max(...systems.map((s) => s.measureStart + s.measureCount - 1))
                : undefined)
            }
            parts={
              parts && parts.length > 0
                ? parts
                : systems && systems.length > 0
                  ? Array.from(new Set(systems.map((s) => s.instrument)))
                      .filter(Boolean)
                      .map((name) => ({ name }))
                  : undefined
            }
            activeMeasure={activeMeasure}
            selectedInstrument={selectedInstrument}
            deviceLayout={deviceLayout}
            darkMode={true}
            showCursor={true}
            showControls={true}
            labels={{
              loading: uiLabels.loadingScore,
              activePart: uiLabels.activePart,
              allInstruments: 'Todos',
            }}
          />
        </div>
      )}
    </div>
  )
}
