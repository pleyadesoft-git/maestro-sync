'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams<{ locale: string }>()
  const locale = params?.locale || 'es'

  useEffect(() => {
    console.error('[MaestroSync] Error de render:', error)
  }, [error])

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-rose-400" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-xl font-bold text-slate-100">Algo salió mal</h1>
        <p className="text-sm text-slate-400">
          Ocurrió un error inesperado al cargar esta pantalla. Tu sesión y tu partitura no se vieron afectadas.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-600 font-mono">Referencia: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
        <Link
          href={`/${locale}`}
          className="h-12 px-5 rounded-xl border border-slate-700 text-slate-300 font-semibold inline-flex items-center hover:bg-slate-800 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
