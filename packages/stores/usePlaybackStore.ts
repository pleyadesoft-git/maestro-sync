import { create } from 'zustand'

export type PlaybackStatus = 'waiting' | 'playing' | 'paused' | 'stopped' | 'ended'

interface PlaybackState {
  status: PlaybackStatus
  tempoBpm: number
  currentMeasure: number
  playbackStartedAt: string | null
  timeSignatureBeats: number
  setPlayback: (data: {
    status: PlaybackStatus
    tempoBpm: number
    currentMeasure: number
    playbackStartedAt: string | null
  }) => void
  setTempo: (tempoBpm: number) => void
  setMeasure: (measure: number) => void
  setStatus: (status: PlaybackStatus) => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  status: 'waiting',
  tempoBpm: 120,
  currentMeasure: 1,
  playbackStartedAt: null,
  timeSignatureBeats: 4,
  setPlayback: (data) =>
    set({
      status: data.status,
      tempoBpm: data.tempoBpm,
      currentMeasure: data.currentMeasure,
      playbackStartedAt: data.playbackStartedAt,
    }),
  setTempo: (tempoBpm) => set({ tempoBpm }),
  setMeasure: (currentMeasure) => set({ currentMeasure }),
  setStatus: (status) => set({ status }),
}))
