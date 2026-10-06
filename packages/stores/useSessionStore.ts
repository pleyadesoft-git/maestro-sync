import { create } from 'zustand'
import type { Database } from '@music-flow/supabase'

type Participant = Database['public']['Tables']['session_participants']['Row'] & {
  profile?: Database['public']['Tables']['profiles']['Row']
  instrument?: Database['public']['Tables']['instruments']['Row']
}

interface SessionState {
  sessionId: string | null
  roomCode: string | null
  role: 'director' | 'performer'
  directorUserId: string | null
  workVersionId: string | null
  selectedInstrumentId: string | null
  participants: Participant[]
  setSession: (data: {
    sessionId: string
    roomCode: string
    role: 'director' | 'performer'
    directorUserId: string
    workVersionId: string
  }) => void
  setSelectedInstrument: (instrumentId: string | null) => void
  setParticipants: (participants: Participant[]) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  roomCode: null,
  role: 'performer',
  directorUserId: null,
  workVersionId: null,
  selectedInstrumentId: null,
  participants: [],
  setSession: (data) =>
    set({
      sessionId: data.sessionId,
      roomCode: data.roomCode,
      role: data.role,
      directorUserId: data.directorUserId,
      workVersionId: data.workVersionId,
    }),
  setSelectedInstrument: (selectedInstrumentId) => set({ selectedInstrumentId }),
  setParticipants: (participants) => set({ participants }),
  clearSession: () =>
    set({
      sessionId: null,
      roomCode: null,
      role: 'performer',
      directorUserId: null,
      workVersionId: null,
      selectedInstrumentId: null,
      participants: [],
    }),
}))
