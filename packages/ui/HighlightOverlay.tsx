import React from 'react'
import { motion } from 'framer-motion'

interface HighlightOverlayProps {
  bboxX: number // 0 - 1
  bboxY: number // 0 - 1
  bboxW: number // 0 - 1
  bboxH: number // 0 - 1
  label?: string
  isActive?: boolean
}

export function HighlightOverlay({
  bboxX,
  bboxY,
  bboxW,
  bboxH,
  label,
  isActive = true,
}: HighlightOverlayProps) {
  if (!isActive) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        position: 'absolute',
        left: `${bboxX * 100}%`,
        top: `${bboxY * 100}%`,
        width: `${bboxW * 100}%`,
        height: `${bboxH * 100}%`,
      }}
      className="pointer-events-none rounded-lg border-2 border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/25 ring-4 ring-amber-400/10"
    >
      {label && (
        <span className="absolute -top-7 left-2 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950 shadow-md">
          {label}
        </span>
      )}
    </motion.div>
  )
}
