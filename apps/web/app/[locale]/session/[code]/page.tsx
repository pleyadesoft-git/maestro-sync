'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  MusicScoreSheet,
  type ScorePageData,
  type ScoreSystemData,
  type MeasureIndicatorStyle,
} from '@music-flow/ui'
import { usePlaybackStore, useSessionStore } from '@music-flow/stores'
import { createBrowserClient } from '@music-flow/supabase'
import { renderPdfToDataUrl } from '@/lib/pdfRenderer'
import {
  Play,
  Pause,
  Square,
  Rewind,
  FastForward,
  Users,
  ChevronLeft,
  Radio,
  AlertTriangle,
  Loader2,
  Smartphone,
  Tablet,
  Monitor,
  Sliders,
  Footprints,
  Music,
  Check,
  X,
  Bell,
  Sparkles,
  Timer,
  HandMetal,
} from 'lucide-react'

type PlaybackStatus = 'waiting' | 'playing' | 'paused' | 'stopped' | 'ended'

type PlaybackPayload = {
  status: PlaybackStatus
  tempoBpm: number
  currentMeasure: number
  playbackStartedAt: string | null
}

type PresenceInfo = {
  user: string
  userId?: string
  instrument: string
  joined_at: string
}

// Punto de referencia temporal del playback: desde aquí se deriva el compás
// en cada frame sin acumular drift ni depender de eventos por compás.
type PlaybackAnchor = {
  atMs: number
  measure: number
  tempo: number
}

// Catálogo sembrado en public.instruments → Etiqueta amigable de lectura
const INSTRUMENT_CODE_TO_LABEL: Record<string, string> = {
  violin_1: 'Violín I',
  violin_2: 'Violín II',
  viola: 'Viola',
  cello: 'Violonchelo',
  contrabass: 'Contrabajo',
  flute: 'Flauta',
  oboe: 'Oboe',
  clarinet: 'Clarinete',
  bassoon: 'Fagot',
  horn: 'Corno',
  trumpet: 'Trompeta',
  trombone: 'Trombón',
  tuba: 'Tuba',
  percussion: 'Percusión',
  piano: 'Piano',
  soprano: 'Soprano',
  alto: 'Contralto',
  tenor: 'Tenor',
  bass: 'Bajo',
}

const FALLBACK_SYSTEMS: ScoreSystemData[] = [
  { id: 's1', pageNumber: 1, measureStart: 1, measureCount: 4, bboxX: 0.04, bboxY: 0.14, bboxW: 0.94, bboxH: 0.17, instrument: 'Violín I' },
  { id: 's2', pageNumber: 1, measureStart: 5, measureCount: 4, bboxX: 0.04, bboxY: 0.35, bboxW: 0.94, bboxH: 0.17, instrument: 'Violín II' },
  { id: 's3', pageNumber: 1, measureStart: 9, measureCount: 4, bboxX: 0.04, bboxY: 0.56, bboxW: 0.94, bboxH: 0.17, instrument: 'Viola' },
  { id: 's4', pageNumber: 1, measureStart: 13, measureCount: 4, bboxX: 0.04, bboxY: 0.77, bboxW: 0.94, bboxH: 0.17, instrument: 'Violonchelo' },
]

function SessionContent({ params }: { params?: Promise<{ locale: string; code: string }> }) {
  const routeParams = useParams<{ locale?: string; code?: string }>()
  const code = (routeParams?.code ?? '').toUpperCase()
  const locale = routeParams?.locale ?? 'es'

  const supabase = createBrowserClient()

  const {
    status,
    tempoBpm,
    currentMeasure,
    timeSignature,
    timeSignatureBeats,
    setPlayback,
    setMeasure,
    setTimeSignature,
  } = usePlaybackStore()
  const { setSession, clearSession } = useSessionStore()

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [activeSystemIndex, setActiveSystemIndex] = useState(0)
  const [activePageNumber, setActivePageNumber] = useState(1)
  const [selectedInstrument, setSelectedInst] = useState('Violín I')
  const [scorePages, setScorePages] = useState<ScorePageData[]>([])
  const [scoreSystems, setScoreSystems] = useState<ScoreSystemData[]>(FALLBACK_SYSTEMS)
  const [totalMeasures, setTotalMeasures] = useState<number | null>(null)
  const [connectedUsers, setConnectedUsers] = useState<PresenceInfo[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [sessionInfo, setSessionInfo] = useState<{
    id: string
    workVersionId: string
    directorUserId: string
    title: string
    composer: string
    subtitle: string
    keySignature?: string | null
    timeSignature?: string | null
  } | null>(null)

  // Layout adaptativo y modo de atril
  const [deviceLayout, setDeviceLayout] = useState<'mobile' | 'tablet' | 'desktop'>('tablet')
  const [indicatorStyle, setIndicatorStyle] = useState<MeasureIndicatorStyle | 'none'>('subtle')
  const [syncMode, setSyncMode] = useState<'metronome' | 'manual'>('metronome')
  const [showStandManager, setShowStandManager] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [targetInstrumentForUser, setTargetInstrumentForUser] = useState<Record<string, string>>({})
  const [isReassigning, setIsReassigning] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const anchorRef = useRef<PlaybackAnchor | null>(null)
  const rafRef = useRef<number | null>(null)
  const measureRef = useRef(currentMeasure)
  const systemIndexRef = useRef(0)
  const scoreSystemsRef = useRef(scoreSystems)
  const selectedInstRef = useRef(selectedInstrument)
  const sessionIdRef = useRef<string | null>(null)
  const totalMeasuresRef = useRef<number | null>(null)
  const isDirectorRef = useRef(false)

  useEffect(() => {
    measureRef.current = currentMeasure
  }, [currentMeasure])

  useEffect(() => {
    scoreSystemsRef.current = scoreSystems
  }, [scoreSystems])

  useEffect(() => {
    selectedInstRef.current = selectedInstrument
  }, [selectedInstrument])

  useEffect(() => {
    totalMeasuresRef.current = totalMeasures
  }, [totalMeasures])

  const isDirector = Boolean(sessionInfo && userId && sessionInfo.directorUserId === userId)
  useEffect(() => {
    isDirectorRef.current = isDirector
  }, [isDirector])

  // Catálogo dinámico de atriles presentes en la obra actual
  const availableInstruments = useMemo(() => {
    const unique = Array.from(new Set(scoreSystems.map((s) => s.instrument))).filter(Boolean)
    return unique.length > 0 ? unique : ['Violín I', 'Violín II', 'Viola', 'Violonchelo']
  }, [scoreSystems])

  // Localizar el sistema que abarca el compás, respetando prioritariamente el instrumento elegido
  const findSystemIndex = (measure: number, instrument: string) => {
    const systems = scoreSystemsRef.current
    if (!systems || systems.length === 0) return -1
    const normalizedInst = instrument.trim().toLowerCase()

    // 1. Coincidencia exacta de compás e instrumento seleccionado
    const exactIdx = systems.findIndex(
      (sys) =>
        measure >= sys.measureStart &&
        measure < sys.measureStart + sys.measureCount &&
        sys.instrument.trim().toLowerCase() === normalizedInst
    )
    if (exactIdx !== -1) return exactIdx

    // 2. Coincidencia de compás general si no existe arreglo específico para este instrumento
    return systems.findIndex(
      (sys) => measure >= sys.measureStart && measure < sys.measureStart + sys.measureCount
    )
  }

  // Cambio manual de atril / instrumento por el ejecutante
  const handleInstrumentChange = (newInst: string) => {
    setSelectedInst(newInst)
    selectedInstRef.current = newInst
    const idx = findSystemIndex(measureRef.current, newInst)
    if (idx !== -1) {
      systemIndexRef.current = idx
      setActiveSystemIndex(idx)
      const sys = scoreSystemsRef.current[idx]
      if (sys?.pageNumber) {
        setActivePageNumber(sys.pageNumber)
      }
    }
  }

  // Compás resultante de la ancla temporal (sin acumular drift y derivado por requestAnimationFrame)
  const measureFromAnchor = (): number | null => {
    const anchor = anchorRef.current
    if (!anchor || anchor.tempo <= 0) return null
    const elapsedSec = Math.max(0, (Date.now() - anchor.atMs) / 1000)
    const secondsPerMeasure = (timeSignatureBeats * 60) / anchor.tempo
    const calculated = anchor.measure + Math.floor(elapsedSec / secondsPerMeasure)
    if (totalMeasuresRef.current && calculated > totalMeasuresRef.current) {
      return totalMeasuresRef.current
    }
    return calculated
  }

  const applyPlayback = (next: PlaybackPayload) => {
    setPlayback(next)
    if (next.status === 'playing' && next.playbackStartedAt) {
      const parsed = Date.parse(next.playbackStartedAt)
      anchorRef.current = {
        atMs: Number.isNaN(parsed) ? Date.now() : parsed,
        measure: next.currentMeasure,
        tempo: next.tempoBpm,
      }
    } else {
      anchorRef.current = null
    }
    const idx = findSystemIndex(next.currentMeasure, selectedInstRef.current)
    if (idx !== -1 && idx !== systemIndexRef.current) {
      systemIndexRef.current = idx
      setActiveSystemIndex(idx)
      const sys = scoreSystemsRef.current[idx]
      if (sys?.pageNumber) {
        setActivePageNumber(sys.pageNumber)
      }
    }
  }

  // Auto-desvanecer notificaciones toast
  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 4000)
    return () => clearTimeout(t)
  }, [notification])

  // Detección automática del dispositivo de lectura (Punto 8)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setDeviceLayout('mobile')
      } else if (window.innerWidth < 1024) {
        setDeviceLayout('tablet')
      } else {
        setDeviceLayout('desktop')
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Screen Wake Lock API — Pantalla siempre activa en atriles
  useEffect(() => {
    let wakeLock: any = null
    const requestLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen')
        }
      } catch {
        /* no soportado o bloqueado */
      }
    }
    void requestLock()
    const handleVis = () => {
      if (document.visibilityState === 'visible') void requestLock()
    }
    document.addEventListener('visibilitychange', handleVis)
    return () => {
      document.removeEventListener('visibilitychange', handleVis)
      if (wakeLock) wakeLock.release().catch(() => {})
    }
  }, [])


  // Asignación de atril por el director en tiempo real (Punto 7)
  const handleAssignStand = async (targetUser: PresenceInfo, newInstrument: string) => {
    if (!channelRef.current || !targetUser.userId) return
    setIsReassigning(true)
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'stand_assignment',
        payload: {
          targetUserId: targetUser.userId,
          newInstrument,
        },
      })
      setNotification(`Atril "${newInstrument}" asignado con éxito a ${targetUser.user === 'director' ? 'Director' : 'Músico'}.`)
    } finally {
      setIsReassigning(false)
    }
  }

  // 1) Unirse a la sala (RPC security definer) + cargar obra, partituras y páginas reales
  useEffect(() => {
    let cancelled = false

    const joinAndLoad = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user
        if (!user) {
          setNeedsAuth(true)
          throw new Error('Inicia sesión para entrar a la sala de ensayo.')
        }

        let sessionRow: any = null
        try {
          const { data, error } = await supabase.rpc('join_session', {
            p_room_code: code,
          })
          if (!error && data) {
            sessionRow = data
          }
        } catch {
          /* fallback a endpoint */
        }

        if (!sessionRow) {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData.session?.access_token
          if (!token) throw new Error('Inicia sesión para entrar a la sala de ensayo.')

          const res = await fetch('/api/sessions/join', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ roomCode: code }),
          })
          const json = await res.json()
          if (!res.ok || !json.ok || !json.session) {
            throw new Error(json.error || `La sala «${code.toUpperCase()}» no existe o ya finalizó.`)
          }
          sessionRow = json.session
        }


        if (cancelled) return
        sessionIdRef.current = sessionRow.id
        setUserId(user.id)
        const isDirectorUser = sessionRow.director_user_id === user.id
        setSession({
          sessionId: sessionRow.id,
          roomCode: sessionRow.room_code,
          role: isDirectorUser ? 'director' : 'performer',
          directorUserId: sessionRow.director_user_id,
          workVersionId: sessionRow.work_version_id,
        })

        // Consultas en paralelo: Versión + Obras y Scores
        const [{ data: version }, { data: scoreRecord }] = await Promise.all([
          supabase
            .from('work_versions')
            .select(
              `id, version_name, tempo_bpm_override, total_measures_override,
               works ( id, title, composer, catalog_reference, key_signature, time_signature, default_tempo_bpm, total_measures )`
            )
            .eq('id', sessionRow.work_version_id)
            .maybeSingle(),
          supabase
            .from('scores')
            .select('id, file_path, file_type, page_count')
            .eq('work_version_id', sessionRow.work_version_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        if (cancelled) return

        const work = version?.works as any
        const effectiveTimeSignature = work?.time_signature || '4/4'
        setTimeSignature(effectiveTimeSignature)

        const maxMeasures = version?.total_measures_override || work?.total_measures || null
        setTotalMeasures(maxMeasures)
        totalMeasuresRef.current = maxMeasures

        setSessionInfo({
          id: sessionRow.id,
          workVersionId: sessionRow.work_version_id,
          directorUserId: sessionRow.director_user_id,
          title: work?.title || 'Partitura',
          composer: work?.composer || '',
          subtitle: version?.version_name || '',
          keySignature: work?.key_signature || null,
          timeSignature: effectiveTimeSignature,
        })

        applyPlayback({
          status: sessionRow.status as PlaybackStatus,
          tempoBpm: sessionRow.tempo_bpm,
          currentMeasure: sessionRow.current_measure,
          playbackStartedAt: sessionRow.playback_started_at,
        })

        // Procesar páginas e imágenes reales si existen
        const processedPages: ScorePageData[] = []
        const loadedSystems: ScoreSystemData[] = []

        if (scoreRecord) {
          const { data: rawPages } = await supabase
            .from('score_pages')
            .select('id, score_id, page_number, image_path, width_px, height_px')
            .eq('score_id', scoreRecord.id)
            .order('page_number', { ascending: true })

          if (rawPages && rawPages.length > 0) {
            for (const p of rawPages) {
              let imageUrl: string | null = null
              if (p.image_path) {
                if (
                  p.image_path.startsWith('http://') ||
                  p.image_path.startsWith('https://') ||
                  p.image_path.startsWith('blob:') ||
                  p.image_path.startsWith('data:')
                ) {
                  imageUrl = p.image_path
                } else {
                  // Obtener signed URL del bucket privado 'scores'
                  const { data: signed } = await supabase.storage
                    .from('scores')
                    .createSignedUrl(p.image_path, 7200)
                  imageUrl = signed?.signedUrl ?? null

                  if (!imageUrl) {
                    try {
                      const { data: sessionData } = await supabase.auth.getSession()
                      const token = sessionData.session?.access_token
                      if (token) {
                        const urlRes = await fetch('/api/scores/signed-url', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ filePath: p.image_path }),
                        })
                        const urlJson = await urlRes.json()
                        if (urlJson.ok && urlJson.signedUrl) {
                          imageUrl = urlJson.signedUrl
                        }
                      }
                    } catch {
                      /* fallback */
                    }
                  }

                  if (!imageUrl) {
                    const { data: pub } = supabase.storage.from('scores').getPublicUrl(p.image_path)
                    imageUrl = pub?.publicUrl ?? null
                  }

                }
              }

              // Si el archivo de la página es PDF, rasterizar la página a imagen PNG usando PDF.js
              const isPdf =
                (p.image_path && p.image_path.toLowerCase().endsWith('.pdf')) ||
                scoreRecord?.file_type === 'pdf'

              if (isPdf && imageUrl) {
                try {
                  const rendered = await renderPdfToDataUrl(imageUrl, p.page_number || 1)
                  if (rendered?.dataUrl) {
                    imageUrl = rendered.dataUrl
                    p.width_px = rendered.width
                    p.height_px = rendered.height
                  }
                } catch (pdfErr) {
                  console.warn('[Session] Error rasterizando página PDF:', pdfErr)
                }
              }

              processedPages.push({
                id: p.id,
                pageNumber: p.page_number,
                imageUrl,
                widthPx: p.width_px,
                heightPx: p.height_px,
              })
            }

            const pageIds = rawPages.map((p) => p.id)
            const { data: pageSystems } = await (supabase as any)
              .from('score_systems')
              .select(
                `id, score_page_id, system_order, measure_start, measure_count, bbox_x, bbox_y, bbox_w, bbox_h,
                 instruments ( code )`
              )
              .in('score_page_id', pageIds)
              .order('measure_start', { ascending: true })

            const pageNumberById = new Map<string, number>()
            for (const p of rawPages) pageNumberById.set(p.id, p.page_number)

            for (const sys of ((pageSystems ?? []) as any[])) {
              const instCode = sys.instruments?.code
              const instLabel = instCode
                ? INSTRUMENT_CODE_TO_LABEL[instCode] || instCode
                : 'Violín I'
              loadedSystems.push({
                id: sys.id,
                scorePageId: sys.score_page_id,
                pageNumber: pageNumberById.get(sys.score_page_id) ?? 1,
                measureStart: sys.measure_start,
                measureCount: sys.measure_count,
                bboxX: Number(sys.bbox_x ?? 0.04),
                bboxY: Number(sys.bbox_y ?? 0.08),
                bboxW: Number(sys.bbox_w ?? 0.92),
                bboxH: Number(sys.bbox_h ?? 0.18),
                instrument: instLabel,
              })
            }
          }
        }

        // Si no vinieron sistemas por score_pages, verificar si hay score_systems directos
        if (loadedSystems.length === 0) {
          const { data: directSystems } = await (supabase as any)
            .from('score_systems')
            .select(
              `id, score_page_id, measure_start, measure_count, bbox_x, bbox_y, bbox_w, bbox_h,
               score_pages!inner ( page_number, scores!inner ( work_version_id ) ),
               instruments ( code )`
            )
            .eq('score_pages.scores.work_version_id', sessionRow.work_version_id)
            .order('measure_start', { ascending: true })

          if (directSystems && directSystems.length > 0) {
            for (const s of directSystems as any[]) {
              const instCode = s.instruments?.code
              loadedSystems.push({
                id: s.id,
                scorePageId: s.score_page_id,
                pageNumber: s.score_pages?.page_number ?? 1,
                measureStart: s.measure_start,
                measureCount: s.measure_count,
                bboxX: Number(s.bbox_x ?? 0.04),
                bboxY: Number(s.bbox_y ?? 0.08),
                bboxW: Number(s.bbox_w ?? 0.92),
                bboxH: Number(s.bbox_h ?? 0.18),
                instrument: instCode ? INSTRUMENT_CODE_TO_LABEL[instCode] || instCode : 'Violín I',
              })
            }
          }
        }

        if (cancelled) return

        if (processedPages.length > 0) {
          setScorePages(processedPages)
        }

        if (loadedSystems.length > 0) {
          setScoreSystems(loadedSystems)
          scoreSystemsRef.current = loadedSystems
          // Seleccionar primer instrumento disponible si el default no existe en la obra
          const available = Array.from(new Set(loadedSystems.map((s) => s.instrument))).filter(Boolean)
          if (available.length > 0 && !available.includes(selectedInstRef.current)) {
            setSelectedInst(available[0])
            selectedInstRef.current = available[0]
          }
        }

        setPhase('ready')
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e?.message || 'Error inesperado al entrar a la sala.')
          setPhase('error')
        }
      }
    }

    joinAndLoad()

    return () => {
      cancelled = true
      const sessionId = sessionIdRef.current
      if (sessionId) {
        void supabase.rpc('leave_session', { p_session_id: sessionId })
        clearSession()
      }
      sessionIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // 2) Canal Realtime: broadcast de playback + presencia de la orquesta
  useEffect(() => {
    if (phase !== 'ready') return

    const channel = supabase.channel(`session:${code}`)
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'playback_sync' }, ({ payload }) => {
        applyPlayback(payload as PlaybackPayload)
      })
      .on('broadcast', { event: 'stand_assignment' }, ({ payload }: any) => {
        if (payload?.targetUserId && payload.targetUserId === userId) {
          handleInstrumentChange(payload.newInstrument)
          setNotification(`¡El director te asignó al atril: ${payload.newInstrument}!`)
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, PresenceInfo[]>
        setConnectedUsers(Object.values(state).flat())
      })
      .subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          await channel.track({
            user: userId === sessionInfo?.directorUserId ? 'director' : 'performer',
            userId: userId || undefined,
            instrument: selectedInstrument,
            joined_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, code, userId])

  // Re-track al cambiar de instrumento (sin re-suscribir el canal)
  useEffect(() => {
    if (phase !== 'ready' || !channelRef.current) return
    void channelRef.current.track({
      user: userId === sessionInfo?.directorUserId ? 'director' : 'performer',
      userId: userId || undefined,
      instrument: selectedInstrument,
      joined_at: new Date().toISOString(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstrument, phase, userId])

  // 3) Emisión del director: broadcast al canal suscrito + persistencia en BD
  const broadcastPlayback = useCallback(
    async (next: PlaybackPayload) => {
      applyPlayback(next)
      await channelRef.current?.send({
        type: 'broadcast',
        event: 'playback_sync',
        payload: next,
      })
      if (sessionInfo) {
        await supabase
          .from('sessions')
          .update({
            status: next.status,
            tempo_bpm: next.tempoBpm,
            current_measure: next.currentMeasure,
            playback_started_at: next.playbackStartedAt,
          })
          .eq('id', sessionInfo.id)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionInfo, supabase]
  )

  // 4) Loop de render: deriva el compás desde la ancla temporal sin acumular drift
  useEffect(() => {
    if (phase !== 'ready') return

    const tick = () => {
      const computed = measureFromAnchor()
      if (computed !== null && computed !== measureRef.current) {
        measureRef.current = computed
        setMeasure(computed)
        const idx = findSystemIndex(computed, selectedInstRef.current)
        if (idx !== -1 && idx !== systemIndexRef.current) {
          systemIndexRef.current = idx
          setActiveSystemIndex(idx)
          const sys = scoreSystemsRef.current[idx]
          if (sys?.pageNumber) {
            setActivePageNumber(sys.pageNumber)
          }
        }
        // Fin de la obra alcanzado por el director
        if (
          totalMeasuresRef.current &&
          computed >= totalMeasuresRef.current &&
          isDirectorRef.current
        ) {
          void broadcastPlayback({
            status: 'ended',
            tempoBpm,
            currentMeasure: totalMeasuresRef.current,
            playbackStartedAt: null,
          })
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeSignatureBeats, tempoBpm, broadcastPlayback])

  const handlePlay = () => {
    if (!isDirector) return
    void broadcastPlayback({
      status: 'playing',
      tempoBpm,
      currentMeasure: measureFromAnchor() ?? currentMeasure,
      playbackStartedAt: new Date().toISOString(),
    })
  }

  const handlePause = () => {
    if (!isDirector) return
    void broadcastPlayback({
      status: 'paused',
      tempoBpm,
      currentMeasure: measureFromAnchor() ?? currentMeasure,
      playbackStartedAt: null,
    })
  }

  const handleStop = () => {
    if (!isDirector) return
    systemIndexRef.current = 0
    setActiveSystemIndex(0)
    const firstSys = scoreSystemsRef.current[0]
    if (firstSys?.pageNumber) {
      setActivePageNumber(firstSys.pageNumber)
    }
    void broadcastPlayback({ status: 'stopped', tempoBpm, currentMeasure: 1, playbackStartedAt: null })
  }

  const handleSeek = (targetMeasure: number) => {
    if (!isDirector) return
    const bounded = Math.max(1, totalMeasures ? Math.min(targetMeasure, totalMeasures) : targetMeasure)
    const idx = findSystemIndex(bounded, selectedInstRef.current)
    if (idx !== -1) {
      systemIndexRef.current = idx
      setActiveSystemIndex(idx)
      const sys = scoreSystemsRef.current[idx]
      if (sys?.pageNumber) {
        setActivePageNumber(sys.pageNumber)
      }
    }
    void broadcastPlayback({
      status,
      tempoBpm,
      currentMeasure: bounded,
      playbackStartedAt: status === 'playing' ? new Date().toISOString() : null,
    })
  }

  const handleTempoChange = (newTempo: number) => {
    if (!isDirector) return
    // Re-anclaje desde el compás actual: no reinicia la obra ni acumula drift
    void broadcastPlayback({
      status,
      tempoBpm: newTempo,
      currentMeasure: measureFromAnchor() ?? currentMeasure,
      playbackStartedAt: status === 'playing' ? new Date().toISOString() : null,
    })
  }

  // Soporte para pedales Bluetooth y atajos de teclado (PageDown / PageUp / Espacio)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (isDirectorRef.current && syncMode === 'manual') {
          handleSeek((measureFromAnchor() ?? measureRef.current) + 1)
        } else {
          setActivePageNumber((prev) => {
            const maxPage = scorePages.length > 0 ? scorePages.length : 1
            return Math.min(maxPage, prev + 1)
          })
        }
      } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        if (isDirectorRef.current && syncMode === 'manual') {
          handleSeek(Math.max(1, (measureFromAnchor() ?? measureRef.current) - 1))
        } else {
          setActivePageNumber((prev) => Math.max(1, prev - 1))
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (isDirectorRef.current) {
          if (syncMode === 'manual') {
            handleSeek((measureFromAnchor() ?? measureRef.current) + 1)
          } else {
            if (status === 'playing') handlePause()
            else handlePlay()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncMode, scorePages.length, status])

  if (phase === 'loading') {
    return (
      <main className="h-dvh bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-300">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-sm">Conectando a la sala {code.toUpperCase()}…</p>
      </main>
    )
  }

  if (phase === 'error') {
    return (
      <main className="h-dvh bg-slate-950 flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-100">No se pudo abrir la sala</h1>
          <p className="text-sm text-slate-400 max-w-md">{loadError}</p>
        </div>
        <div className="flex items-center gap-3">
          {needsAuth && (
            <Link
              href={`/${locale}/login`}
              className="px-5 h-12 rounded-xl bg-amber-500 text-slate-950 font-semibold flex items-center justify-center hover:bg-amber-400 transition-colors"
            >
              Iniciar sesión
            </Link>
          )}
          <Link
            href={`/${locale}/library`}
            className="px-5 h-12 rounded-xl border border-slate-700 text-slate-300 font-semibold flex items-center justify-center hover:bg-slate-800 transition-colors"
          >
            Volver a la biblioteca
          </Link>
        </div>
      </main>
    )
  }

  const activeSystem = scoreSystems[activeSystemIndex]

  return (
    <main className="h-dvh min-h-0 bg-slate-950 flex flex-col text-slate-100 select-none overflow-hidden">
      {/* Top Stand Navbar */}
      <header className="h-14 sm:h-16 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/library`}
            className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-lg tracking-tight truncate max-w-[40vw]">
                {sessionInfo?.title || 'Partitura'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-mono font-bold border border-amber-500/30">
                Sala: {code.toUpperCase()}
              </span>
              {isDirector && (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">
                  Director
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">
              {[
                sessionInfo?.composer,
                sessionInfo?.subtitle,
                sessionInfo?.keySignature,
                timeSignature,
              ]
                .filter(Boolean)
                .join(' • ') || 'Sesión de ensayo sincronizada'}
            </p>
          </div>
        </div>

        {/* Top Navbar Actions & Options */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Notification Toast */}
          {notification && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-amber-300 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <Sparkles className="w-4 h-4 text-slate-950 shrink-0" />
              <span>{notification}</span>
            </div>
          )}

          {/* Device Layout Selector (Punto 8) */}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setDeviceLayout('mobile')}
              title="Modo Celular (Enfoque en pentagrama)"
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                deviceLayout === 'mobile'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-[11px]">Móvil</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceLayout('tablet')}
              title="Modo Atril / Tablet (Página completa)"
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                deviceLayout === 'tablet'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="text-[11px]">Atril</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceLayout('desktop')}
              title="Modo Escritorio"
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                deviceLayout === 'desktop'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[11px]">Escritorio</span>
            </button>
          </div>

          {/* Discrete Measure Indicator Selector (Punto 9) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400">Indicador:</span>
            <select
              value={indicatorStyle}
              onChange={(e) => setIndicatorStyle(e.target.value as any)}
              aria-label="Estilo de indicador de compás"
              className="bg-transparent text-amber-400 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="subtle" className="bg-slate-900 text-slate-200">
                Sombreado tenue
              </option>
              <option value="bar" className="bg-slate-900 text-slate-200">
                Cursor vertical
              </option>
              <option value="minimal" className="bg-slate-900 text-slate-200">
                Número discreto
              </option>
              <option value="none" className="bg-slate-900 text-slate-200">
                Oculto
              </option>
            </select>
          </div>

          {/* Director Stand Manager Button (Punto 7) */}
          {isDirector && (
            <button
              type="button"
              onClick={() => setShowStandManager(true)}
              className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-amber-400 font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Atriles de la orquesta</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                {connectedUsers.length}
              </span>
            </button>
          )}

          {/* Status Indicator & Instrument Picker */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${status === 'playing' ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`}
              />
              <span className="capitalize font-semibold text-slate-300 hidden sm:inline">{status}</span>
            </div>

            <select
              value={selectedInstrument}
              onChange={(e) => handleInstrumentChange(e.target.value)}
              aria-label="Seleccionar atril / instrumento"
              className="h-9 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {availableInstruments.map((inst) => (
                <option key={inst} value={inst} className="bg-slate-900 text-slate-200">
                  {inst}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Music Sheet Stand View */}
      <div className="flex-1 relative min-h-0 bg-slate-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden">
        <div className="max-w-4xl w-full h-full bg-slate-900/90 border border-slate-800 rounded-2xl relative p-2 sm:p-4 shadow-2xl flex flex-col overflow-hidden">
          <MusicScoreSheet
            title={sessionInfo?.title || 'Partitura'}
            composer={sessionInfo?.composer || ''}
            subtitle={sessionInfo?.subtitle || ''}
            timeSignature={timeSignature || '4/4'}
            activeSystemIndex={activeSystemIndex}
            activeMeasure={currentMeasure}
            selectedInstrument={selectedInstrument}
            pages={scorePages}
            systems={scoreSystems}
            activePageNumber={activePageNumber}
            onPageChange={setActivePageNumber}
            deviceLayout={deviceLayout}
            measureIndicatorStyle={indicatorStyle}
            highlightLabel={
              activeSystem ? `${selectedInstrument} — Compás ${currentMeasure}` : undefined
            }
          />

          {/* Measure Progress Footer Badge */}
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-6 z-10 bg-slate-950/80 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-800 flex items-center gap-2 sm:gap-3 shadow-xl">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Compás
            </span>
            <span className="font-mono text-lg sm:text-xl font-bold text-amber-400">
              {currentMeasure}
              {totalMeasures ? (
                <span className="text-xs font-normal text-slate-500"> / {totalMeasures}</span>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <footer className="h-16 sm:h-20 shrink-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md px-3 sm:px-8 flex items-center justify-between z-20">
        {/* Sync Mode Toggle for Director */}
        <div className="flex items-center gap-3">
          {isDirector ? (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setSyncMode('metronome')}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-semibold ${
                  syncMode === 'metronome'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Metrónomo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSyncMode('manual')
                  if (status === 'playing') handlePause()
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-semibold ${
                  syncMode === 'manual'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <HandMetal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Manual</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Users className="w-4 h-4 text-amber-400" />
              <span>{connectedUsers.length} en sala</span>
            </div>
          )}
        </div>

        {/* Playback Controls (Metronome vs Manual Mode) */}
        {syncMode === 'manual' && isDirector ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSeek(Math.max(1, currentMeasure - 1))}
              aria-label="Compás anterior"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Compás -</span>
            </button>
            <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-xl text-center">
              <span className="text-[10px] text-amber-300 block uppercase font-mono">Modo Manual</span>
              <span className="text-sm font-bold text-amber-400 font-mono">Compás {currentMeasure}</span>
            </div>
            <button
              onClick={() => handleSeek(currentMeasure + 1)}
              aria-label="Siguiente compás"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center gap-1"
            >
              <span>Siguiente compás</span>
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => handleSeek((measureFromAnchor() ?? currentMeasure) - 4)}
              disabled={!isDirector}
              aria-label="Retroceder 4 compases"
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Rewind className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {status === 'playing' ? (
              <button
                onClick={handlePause}
                disabled={!isDirector}
                aria-label="Pausar"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-all disabled:opacity-50"
              >
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                disabled={!isDirector}
                aria-label="Reproducir"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-all disabled:opacity-50"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
              </button>
            )}

            <button
              onClick={handleStop}
              disabled={!isDirector}
              aria-label="Detener"
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={() => handleSeek((measureFromAnchor() ?? currentMeasure) + 4)}
              disabled={!isDirector}
              aria-label="Avanzar 4 compases"
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FastForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        )}

        {/* Live Tempo Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Tempo
          </span>
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => handleTempoChange(Math.max(40, tempoBpm - 5))}
              disabled={!isDirector}
              aria-label="Reducir tempo"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors font-bold disabled:opacity-50"
            >
              -
            </button>
            <span className="w-9 sm:w-12 text-center font-mono text-xs sm:text-sm font-bold text-amber-400">
              {tempoBpm}
            </span>
            <button
              onClick={() => handleTempoChange(Math.min(240, tempoBpm + 5))}
              disabled={!isDirector}
              aria-label="Aumentar tempo"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors font-bold disabled:opacity-50"
            >
              +
            </button>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-500">BPM</span>
        </div>
      </footer>

      {/* Stand Manager Modal (Punto 7) */}
      {showStandManager && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  Atriles y Asignación de Particellas
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Asigna o reasigna en tiempo real el atril / instrumento a cada músico conectado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStandManager(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Musicians List */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {connectedUsers.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">
                  Esperando a que los músicos se conecten a la sala...
                </p>
              ) : (
                connectedUsers.map((u, idx) => {
                  const targetInst = targetInstrumentForUser[u.userId || String(idx)] || u.instrument
                  return (
                    <div
                      key={u.userId || idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-200 font-semibold truncate">
                            {u.user === 'director' ? 'Director de orquesta' : `Músico (${(u.userId || '').slice(0, 8)})`}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.user === 'director'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {u.user}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Atril actual: <strong className="text-slate-200">{u.instrument}</strong>
                        </p>
                      </div>

                      {/* Reassign select & button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={targetInst}
                          onChange={(e) =>
                            setTargetInstrumentForUser((prev) => ({
                              ...prev,
                              [u.userId || String(idx)]: e.target.value,
                            }))
                          }
                          className="h-8 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                        >
                          {availableInstruments.map((inst) => (
                            <option key={inst} value={inst}>
                              {inst}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAssignStand(u, targetInst)}
                          disabled={isReassigning || targetInst === u.instrument}
                          className="h-8 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 shadow"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Asignar</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStandManager(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function SessionLoading() {
  return (
    <main className="h-dvh bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-300">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      <p className="text-sm">Cargando sala…</p>
    </main>
  )
}

export default function SessionPage(props: {
  params?: Promise<{ locale: string; code: string }>
}) {
  return (
    <React.Suspense fallback={<SessionLoading />}>
      <SessionContent {...props} />
    </React.Suspense>
  )
}
