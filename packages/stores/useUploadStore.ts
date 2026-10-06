import { create } from 'zustand'

export interface ManualSystem {
  id: string
  pageNumber: number
  systemOrder: number
  measureStart: number
  measureCount: number
  instrumentId: string | null
  bboxX: number
  bboxY: number
  bboxW: number
  bboxH: number
}

interface UploadState {
  file: File | null
  title: string
  composer: string
  catalogReference: string
  keySignature: string
  timeSignature: string
  defaultTempoBpm: number
  totalMeasures: number
  pageCount: number
  renderedPages: string[] // data URLs
  systems: ManualSystem[]
  step: 'metadata' | 'render' | 'marking' | 'done'
  setMetadata: (data: Partial<UploadState>) => void
  setRenderedPages: (pages: string[]) => void
  addSystem: (system: ManualSystem) => void
  updateSystem: (id: string, system: Partial<ManualSystem>) => void
  removeSystem: (id: string) => void
  setStep: (step: UploadState['step']) => void
  resetUpload: () => void
}

export const useUploadStore = create<UploadState>((set) => ({
  file: null,
  title: '',
  composer: '',
  catalogReference: '',
  keySignature: 'C major',
  timeSignature: '4/4',
  defaultTempoBpm: 120,
  totalMeasures: 32,
  pageCount: 1,
  renderedPages: [],
  systems: [],
  step: 'metadata',
  setMetadata: (data) => set((state) => ({ ...state, ...data })),
  setRenderedPages: (renderedPages) => set({ renderedPages, pageCount: renderedPages.length }),
  addSystem: (system) => set((state) => ({ systems: [...state.systems, system] })),
  updateSystem: (id, updated) =>
    set((state) => ({
      systems: state.systems.map((sys) => (sys.id === id ? { ...sys, ...updated } : sys)),
    })),
  removeSystem: (id) =>
    set((state) => ({
      systems: state.systems.filter((sys) => sys.id !== id),
    })),
  setStep: (step) => set({ step }),
  resetUpload: () =>
    set({
      file: null,
      title: '',
      composer: '',
      catalogReference: '',
      keySignature: 'C major',
      timeSignature: '4/4',
      defaultTempoBpm: 120,
      totalMeasures: 32,
      pageCount: 1,
      renderedPages: [],
      systems: [],
      step: 'metadata',
    }),
}))
