'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams<{ locale: string }>()
  const locale = params?.locale || 'es'
  const t = useTranslations('errorPage')
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    console.error('[MaestroSync] Render error captured:', error)
  }, [error])

  const errorMessage = error?.message || t('unknownRenderError')
  const isEnvError =
    errorMessage.includes('NEXT_PUBLIC_SUPABASE') || errorMessage.includes('supabase')

  const copyDetails = () => {
    const text = `Error: ${errorMessage}\nDigest: ${error?.digest || 'N/A'}\nStack: ${error?.stack || 'N/A'}`
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <main className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>

      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 shadow-lg shadow-rose-950/40">
        <AlertTriangle className="w-8 h-8 text-rose-400" aria-hidden="true" />
      </div>

      <div className="space-y-3 max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">{t('title')}</h1>
        <p className="text-sm text-slate-400 leading-relaxed">{t('description')}</p>

        {isEnvError && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left">
            <strong>{t('envErrorTitle')}</strong> {t('envErrorBody')}
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-left">
          <p className="text-xs font-mono text-rose-300/90 break-words leading-relaxed">
            {errorMessage}
          </p>
          {error.digest && (
            <p className="text-[11px] text-slate-500 font-mono mt-1.5">
              {t('serverDigest', { digest: error.digest })}
            </p>
          )}
        </div>

        <div className="text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showDetails ? t('hideTechnical') : t('showTechnical')}</span>
          </button>

          {showDetails && (
            <div className="mt-2 p-3 rounded-lg bg-black/60 border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48 text-left">
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  {t('traceHeading')}
                </span>
                <button
                  type="button"
                  onClick={copyDetails}
                  className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? t('copied') : t('copy')}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap">{error.stack || t('noStack')}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-8">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 active:scale-[0.98]"
        >
          <RefreshCw className="w-4 h-4" />
          {t('retry')}
        </button>
        <Link
          href={`/${locale}`}
          className="h-12 px-6 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 font-semibold inline-flex items-center hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          {t('backHome')}
        </Link>
      </div>
    </main>
  )
}
