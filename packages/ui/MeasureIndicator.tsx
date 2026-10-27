import React from 'react'
import { motion } from 'framer-motion'

export type MeasureIndicatorStyle = 'subtle' | 'bar' | 'minimal'

export interface MeasureIndicatorProps {
  bboxX: number // 0 - 1 relative to page container
  bboxY: number // 0 - 1
  bboxW: number // 0 - 1
  bboxH: number // 0 - 1
  measureNumber: number
  style?: MeasureIndicatorStyle
  isActive?: boolean
}

export function MeasureIndicator({
  bboxX,
  bboxY,
  bboxW,
  bboxH,
  measureNumber,
  style = 'subtle',
  isActive = true,
}: MeasureIndicatorProps) {
  if (!isActive) return null

  if (style === 'minimal') {
    return (
      <motion.div
        initial={false}
        animate={{
          left: `${bboxX * 100}%`,
          top: `${bboxY * 100}%`,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        style={{ position: 'absolute' }}
        className="pointer-events-none z-20 -translate-y-2 -translate-x-1"
      >
        <span className="rounded bg-amber-400 text-slate-950 px-1.5 py-0.5 text-[10px] font-mono font-bold shadow-md shadow-amber-400/20 border border-amber-300">
          c.{measureNumber}
        </span>
      </motion.div>
    )
  }

  if (style === 'bar') {
    return (
      <motion.div
        initial={false}
        animate={{
          left: `${bboxX * 100}%`,
          top: `${bboxY * 100}%`,
          height: `${bboxH * 100}%`,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        style={{ position: 'absolute' }}
        className="pointer-events-none z-20 flex flex-col items-center"
      >
        <div className="w-1 h-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.85)] rounded-full animate-pulse" />
        <span className="mt-1 rounded bg-slate-900/90 text-amber-400 border border-amber-400/40 px-1.5 py-0.2 text-[9px] font-mono font-bold shadow">
          {measureNumber}
        </span>
      </motion.div>
    )
  }

  // default 'subtle'
  return (
    <motion.div
      initial={false}
      animate={{
        left: `${bboxX * 100}%`,
        top: `${bboxY * 100}%`,
        width: `${bboxW * 100}%`,
        height: `${bboxH * 100}%`,
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      style={{ position: 'absolute' }}
      className="pointer-events-none z-15 box-border rounded-md border border-amber-400/50 bg-amber-400/15 shadow-[0_0_10px_rgba(251,191,36,0.2)] ring-2 ring-amber-400/10"
    >
      <span className="absolute top-0.5 right-1 rounded bg-slate-950/80 px-1 py-0.2 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30">
        c.{measureNumber}
      </span>
    </motion.div>
  )
}
