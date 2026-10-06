import { create } from 'zustand'
import type { Database } from '@music-flow/supabase'

type Work = Database['public']['Tables']['works']['Row']

interface LibraryState {
  works: Work[]
  selectedWorkId: string | null
  searchQuery: string
  filterComposer: string
  filterInstrument: string
  setWorks: (works: Work[]) => void
  setSelectedWorkId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setFilterComposer: (composer: string) => void
  setFilterInstrument: (instrument: string) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  works: [],
  selectedWorkId: null,
  searchQuery: '',
  filterComposer: '',
  filterInstrument: '',
  setWorks: (works) => set({ works }),
  setSelectedWorkId: (selectedWorkId) => set({ selectedWorkId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterComposer: (filterComposer) => set({ filterComposer }),
  setFilterInstrument: (filterInstrument) => set({ filterInstrument }),
}))
