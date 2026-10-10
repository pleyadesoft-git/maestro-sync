import { create } from 'zustand'

export type PlaybackStatus = 'waiting' | 'playing' | 'paused' | 'stopped' | 'ended'

/**
 * Convierte una indicación de compás (ej. "4/4", "3/4", "2/4", "6/8") en pulsos equivalentes
 * de negra para el cálculo milimétrico de compases por minuto sin drift acumulado.
 */
export function parseTimeSignatureToBeats(timeSignature?: string | null): number {
  if (!timeSignature) return 4
  const trimmed = timeSignature.trim()
  const match = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    const single = parseInt(trimmed, 10)
    return isNaN(single) || single <= 0 ? 4 : single
  }
  const numerator = parseInt(match[1], 10)
  const denominator = parseInt(match[2], 10)
  if (isNaN(numerator) || numerator <= 0) return 4
  if (isNaN(denominator) || denominator <= 0) return numerator
  return numerator * (4 / denominator)
}

interface PlaybackState {
  status: PlaybackStatus
  tempoBpm: number
  currentMeasure: number
  playbackStartedAt: string | null
  timeSignature: string
  timeSignatureBeats: number
  setPlayback: (data: {
    status: PlaybackStatus
    tempoBpm: number
    currentMeasure: number
    playbackStartedAt: string | null
  }) => void
  setTimeSignature: (timeSignature: string) => void
  setTempo: (tempoBpm: number) => void
  setMeasure: (measure: number) => void
  setStatus: (status: PlaybackStatus) => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  status: 'waiting',
  tempoBpm: 120,
  currentMeasure: 1,
  playbackStartedAt: null,
  timeSignature: '4/4',
  timeSignatureBeats: 4,
  setPlayback: (data) =>
    set({
      status: data.status,
      tempoBpm: data.tempoBpm,
      currentMeasure: data.currentMeasure,
      playbackStartedAt: data.playbackStartedAt,
    }),
  setTimeSignature: (timeSignature) =>
    set({
      timeSignature: timeSignature || '4/4',
      timeSignatureBeats: parseTimeSignatureToBeats(timeSignature),
    }),
  setTempo: (tempoBpm) => set({ tempoBpm }),
  setMeasure: (currentMeasure) => set({ currentMeasure }),
  setStatus: (status) => set({ status }),
}))
