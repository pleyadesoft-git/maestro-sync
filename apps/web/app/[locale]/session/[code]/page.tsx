'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MusicScoreSheet } from '@music-flow/ui'
import { usePlaybackStore, useSessionStore } from '@music-flow/stores'
import { createBrowserClient } from '@music-flow/supabase'
import {
  Play,
  Pause,
  Square,
  Rewind,
  FastForward,
  Users,
  Music,
  Crown,
  ChevronLeft,
  Volume2,
  Settings,
  Radio,
} from 'lucide-react'

// Realtime synchronization will fetch score systems from the database
interface ScoreSystem {
  id: string
  measureStart: number
  measureCount: number
  bboxX: number
  bboxY: number
  bboxW: number
  bboxH: number
  instrument: string
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>
}) {
  const { locale, code } = React.use(params)
  const searchParams = useSearchParams()
  const isDirectorParam = searchParams.get('role') === 'director'

  const { status, tempoBpm, currentMeasure, setPlayback, setTempo, setMeasure, setStatus } = usePlaybackStore()
  const { role, selectedInstrumentId, setSelectedInstrument, setSession } = useSessionStore()

  const [activeSystemIndex, setActiveSystemIndex] = useState(0)
  const [selectedInstrument, setSelectedInst] = useState('Violín I')
  const [scoreSystems, setScoreSystems] = useState<ScoreSystem[]>([
    { id: 's1', measureStart: 1, measureCount: 4, bboxX: 0.04, bboxY: 0.14, bboxW: 0.94, bboxH: 0.17, instrument: 'Violín I' },
    { id: 's2', measureStart: 5, measureCount: 4, bboxX: 0.04, bboxY: 0.35, bboxW: 0.94, bboxH: 0.17, instrument: 'Violín II' },
    { id: 's3', measureStart: 9, measureCount: 4, bboxX: 0.04, bboxY: 0.56, bboxW: 0.94, bboxH: 0.17, instrument: 'Viola' },
    { id: 's4', measureStart: 13, measureCount: 4, bboxX: 0.04, bboxY: 0.77, bboxW: 0.94, bboxH: 0.17, instrument: 'Violonchelo' },
  ])
  const [connectedUsers, setConnectedUsers] = useState<any[]>([])
  
  const supabase = createBrowserClient()

  // Initial Data Fetch
  useEffect(() => {
    const fetchSessionData = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('room_code', code)
        .single()
      const sessionData = data as any
      
      if (sessionData) {
        setPlayback({
          status: sessionData.status as any,
          tempoBpm: sessionData.tempo_bpm,
          currentMeasure: sessionData.current_measure,
          playbackStartedAt: sessionData.playback_started_at
        })

        // 2. Fetch Score Systems for this session's work_version_id
        // NOTE: A real implementation would join score_pages and instruments. 
        // For the scope of this update, we will assume a generic fetch structure.
        const { data: systemsData } = await supabase
          .from('score_systems')
          .select(`
            id, measure_start, measure_count, bbox_x, bbox_y, bbox_w, bbox_h,
            score_pages!inner (
              scores!inner ( work_version_id )
            ),
            instruments ( code )
          `)
          .eq('score_pages.scores.work_version_id', sessionData.work_version_id)
          .order('measure_start', { ascending: true })

        if (systemsData && systemsData.length > 0) {
          const mapped = systemsData.map((s: any) => ({
            id: s.id,
            measureStart: s.measure_start,
            measureCount: s.measure_count,
            bboxX: Number(s.bbox_x || 0.04),
            bboxY: Number(s.bbox_y || 0.08),
            bboxW: Number(s.bbox_w || 0.92),
            bboxH: Number(s.bbox_h || 0.18),
            instrument: s.instruments?.code || 'Violín I'
          }))
          setScoreSystems(mapped)
        } else {
          // Fallback to mock for visual testing if DB is empty
          setScoreSystems([
            { id: 's1', measureStart: 1, measureCount: 4, bboxX: 0.04, bboxY: 0.08, bboxW: 0.92, bboxH: 0.18, instrument: 'Violín I' },
            { id: 's2', measureStart: 5, measureCount: 4, bboxX: 0.04, bboxY: 0.30, bboxW: 0.92, bboxH: 0.18, instrument: 'Violín I' },
            { id: 's3', measureStart: 9, measureCount: 4, bboxX: 0.04, bboxY: 0.52, bboxW: 0.92, bboxH: 0.18, instrument: 'Violín I' },
            { id: 's4', measureStart: 13, measureCount: 4, bboxX: 0.04, bboxY: 0.74, bboxW: 0.92, bboxH: 0.18, instrument: 'Violín I' },
          ])
        }
      }
    }
    
    fetchSessionData()
  }, [code, supabase, setPlayback])

  // Realtime Subscriptions
  useEffect(() => {
    const channel = supabase.channel(`session:${code}`)
    
    channel
      .on('broadcast', { event: 'playback_sync' }, (payload) => {
        if (!isDirectorParam) {
          setPlayback(payload.payload)
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flat()
        setConnectedUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            user: role, 
            instrument: selectedInstrument, 
            joined_at: new Date().toISOString() 
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [code, supabase, isDirectorParam, role, selectedInstrument, setPlayback])

  // Helper to broadcast changes (only for director)
  const broadcastPlayback = async (newPlaybackState: any) => {
    setPlayback(newPlaybackState)
    if (isDirectorParam) {
      // 1. Broadcast via realtime for immediate low-latency sync
      await supabase.channel(`session:${code}`).send({
        type: 'broadcast',
        event: 'playback_sync',
        payload: newPlaybackState
      })
      
      // 2. Persist to database for reconnection state
      await (supabase.from('sessions') as any).update({
        status: newPlaybackState.status,
        tempo_bpm: newPlaybackState.tempoBpm,
        current_measure: newPlaybackState.currentMeasure,
        playback_started_at: newPlaybackState.playbackStartedAt
      }).eq('room_code', code)
    }
  }

  const requestRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Realtime loop using requestAnimationFrame + playback_started_at
  useEffect(() => {
    if (status !== 'playing') {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      return
    }

    const animateHighlight = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsedSeconds = (timestamp - startTimeRef.current) / 1000

      // Calculate measure duration: 4 beats per measure at current tempoBpm
      const secondsPerMeasure = (4 * 60) / tempoBpm
      const measuresAdvanced = Math.floor(elapsedSeconds / secondsPerMeasure)
      const newMeasure = 1 + (measuresAdvanced % 16)

      setMeasure(newMeasure)

      // Determine highlighted system index
      const sysIdx = scoreSystems.findIndex(
        (sys) => newMeasure >= sys.measureStart && newMeasure < sys.measureStart + sys.measureCount
      )
      if (sysIdx !== -1) {
        setActiveSystemIndex(sysIdx)
      }

      requestRef.current = requestAnimationFrame(animateHighlight)
    }

    requestRef.current = requestAnimationFrame(animateHighlight)

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [status, tempoBpm, setMeasure, scoreSystems])

  const handlePlay = () => {
    const startedAt = new Date().toISOString()
    startTimeRef.current = performance.now()
    broadcastPlayback({ status: 'playing', tempoBpm, currentMeasure, playbackStartedAt: startedAt })
  }

  const handlePause = () => {
    broadcastPlayback({ status: 'paused', tempoBpm, currentMeasure, playbackStartedAt: null })
  }

  const handleStop = () => {
    setActiveSystemIndex(0)
    broadcastPlayback({ status: 'stopped', tempoBpm, currentMeasure: 1, playbackStartedAt: null })
  }

  const handleSeek = (newMeasure: number) => {
    const measure = Math.max(1, newMeasure)
    const sysIdx = scoreSystems.findIndex(
      (sys) => measure >= sys.measureStart && measure < sys.measureStart + sys.measureCount
    )
    if (sysIdx !== -1) {
      setActiveSystemIndex(sysIdx)
    }
    broadcastPlayback({ status, tempoBpm, currentMeasure: measure, playbackStartedAt: status === 'playing' ? new Date().toISOString() : null })
  }

  const handleTempoChange = (newTempo: number) => {
    broadcastPlayback({ status, tempoBpm: newTempo, currentMeasure, playbackStartedAt: status === 'playing' ? new Date().toISOString() : null })
  }

  const isDirector = isDirectorParam || role === 'director'

  return (
    <main className="h-dvh min-h-0 bg-slate-950 flex flex-col text-slate-100 select-none overflow-hidden">
      {/* Top Stand Navbar */}
      <header className="h-14 sm:h-16 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/library`} className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-lg tracking-tight">Sinfonía No. 5</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-mono font-bold border border-amber-500/30">
                Sala: {code}
              </span>
            </div>
            <p className="text-xs text-slate-400">Ludwig van Beethoven • Compás 2/4</p>
          </div>
        </div>

        {/* Status Indicator & Instrument Picker */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Radio className={`w-3.5 h-3.5 ${status === 'playing' ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="capitalize font-semibold text-slate-300">{status}</span>
          </div>

          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInst(e.target.value)}
            className="h-9 px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="Violín I">Atril: Violín I</option>
            <option value="Violín II">Atril: Violín II</option>
            <option value="Viola">Atril: Viola</option>
            <option value="Violonchelo">Atril: Violonchelo</option>
          </select>
        </div>
      </header>

      {/* Main Music Sheet Stand View */}
      <div className="flex-1 relative min-h-0 bg-slate-950 p-3 sm:p-6 flex items-center justify-center overflow-hidden">
        <div className="max-w-4xl w-full h-full bg-slate-900/90 border border-slate-800 rounded-2xl relative p-3 sm:p-6 shadow-2xl flex flex-col overflow-hidden">
          {/* Real Music Sheet with Notes, Clefs and Staves */}
          <MusicScoreSheet
            title="Sinfonía No. 5 en Do menor"
            composer="Ludwig van Beethoven, Op. 67"
            subtitle="I. Allegro con brio"
            timeSignature="2/4"
            activeSystemIndex={activeSystemIndex}
            activeMeasure={currentMeasure}
            selectedInstrument={selectedInstrument}
            highlightLabel={
              scoreSystems[activeSystemIndex]
                ? `${selectedInstrument} — Compás ${scoreSystems[activeSystemIndex].measureStart}`
                : undefined
            }
          />

          {/* Measure Progress Footer Badge */}
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-6 z-10 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Compás</span>
            <span className="font-mono text-xl font-bold text-amber-400">{currentMeasure}</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Toolbar (Director Controls / Musicians Toolbar) */}
      <footer className="h-16 sm:h-20 shrink-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md px-3 sm:px-8 flex items-center justify-between z-20">
        {/* Connected Participants */}
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Users className="w-4 h-4 text-amber-400" />
          <span>{connectedUsers.length} músicos en sala</span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSeek(currentMeasure - 4)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <Rewind className="w-5 h-5" />
          </button>

          {status === 'playing' ? (
            <button
              onClick={handlePause}
              disabled={!isDirector}
              className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-all disabled:opacity-50"
            >
              <Pause className="w-6 h-6 fill-current" />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={!isDirector}
              className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-all disabled:opacity-50"
            >
              <Play className="w-6 h-6 fill-current ml-0.5" />
            </button>
          )}

          <button
            onClick={handleStop}
            disabled={!isDirector}
            className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Square className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleSeek(currentMeasure + 4)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <FastForward className="w-5 h-5" />
          </button>
        </div>

        {/* Live Tempo Controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tempo</span>
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => handleTempoChange(Math.max(40, tempoBpm - 5))}
              disabled={!isDirector}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors font-bold disabled:opacity-50"
            >
              -
            </button>
            <span className="w-12 text-center font-mono text-sm font-bold text-amber-400">{tempoBpm}</span>
            <button
              onClick={() => handleTempoChange(Math.min(240, tempoBpm + 5))}
              disabled={!isDirector}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors font-bold disabled:opacity-50"
            >
              +
            </button>
          </div>
          <span className="text-xs text-slate-500">BPM</span>
        </div>
      </footer>
    </main>
  )
}
