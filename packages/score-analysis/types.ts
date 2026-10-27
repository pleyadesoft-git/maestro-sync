export interface DetectedMeasure {
  measureNumber: number
  xStart: number // 0.0 - 1.0 (normalized)
  xEnd: number   // 0.0 - 1.0 (normalized)
}

export interface DetectedStaff {
  id?: string
  staffOrder: number
  bboxX: number // 0.0 - 1.0
  bboxY: number
  bboxW: number
  bboxH: number
  instrumentGuess?: string
  partName?: string
  confidence: number // 0.0 - 1.0
}

export interface DetectedSystem {
  id?: string
  systemOrder: number
  measureStart: number
  measureCount: number
  bboxX: number
  bboxY: number
  bboxW: number
  bboxH: number
  staves: DetectedStaff[]
  measures: DetectedMeasure[]
  confidence: number
}

export interface DetectedPage {
  pageNumber: number
  widthPx?: number
  heightPx?: number
  systems: DetectedSystem[]
}

export interface PlaybackJump {
  at: number     // measure where the jump occurs
  to: number     // target measure
  times: number  // times to jump
  label: 'repeat' | 'da_capo' | 'dal_segno' | 'coda' | 'ending'
}

export interface DetectedPart {
  name: string
  instrumentCode?: string
  partOrder: number
  deskCount?: number
}

export interface ScoreAnalysisResult {
  title?: string
  composer?: string
  catalogRef?: string
  keySignature?: string
  timeSignature?: string
  tempoBpm?: number
  totalMeasures?: number
  pageCount: number
  parts: DetectedPart[]
  pages: DetectedPage[]
  playbackMap: PlaybackJump[]
  isMultiInstrumental?: boolean
  confidence: {
    metadata: number // 0.0 - 1.0
    layout: number   // 0.0 - 1.0
  }
  source: 'auto' | 'musicxml' | 'manual'
  warnings: string[]
}
