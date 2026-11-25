'use client'

import React, { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { WifiOff, RefreshCw, Home } from 'lucide-react'

function subscribeNoop() {
  return () => {}
}

function getIsEnglishSnapshot() {
  if (typeof navigator === 'undefined') return false
  return Boolean(navigator.language?.toLowerCase().startsWith('en'))
}

export default function OfflinePage() {
  const isEnglish = useSyncExternalStore(subscribeNoop, getIsEnglishSnapshot, () => false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      window.location.reload()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const handleRetry = () => {
    setRetrying(true)
    window.location.reload()
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-md w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-8 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400">
          <WifiOff className="h-8 w-8" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-slate-100">
          {isEnglish ? 'You are offline' : 'Sin conexión a internet'}
        </h1>

        <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
          {isEnglish
            ? 'This page is not cached yet for offline use. MaestroSync will reconnect automatically as soon as your network returns.'
            : 'Esta página aún no está guardada en caché para uso sin conexión. MaestroSync se reconectará automáticamente en cuanto vuelva tu red.'}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full sm:w-auto h-12 px-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-sm transition-colors shadow-md shadow-amber-500/20 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isEnglish ? 'Retry connection' : 'Reintentar conexión'}</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto h-12 px-5 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            <span>{isEnglish ? 'Go home' : 'Ir al inicio'}</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
