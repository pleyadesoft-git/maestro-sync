'use client'

import React, { useSyncExternalStore } from 'react'
import { Download, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface PWAInstallButtonProps {
  className?: string
  variant?: 'badge' | 'button' | 'minimal'
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia('(display-mode: standalone)')
  mql.addEventListener('change', callback)
  window.addEventListener('appinstalled', callback)
  return () => {
    mql.removeEventListener('change', callback)
    window.removeEventListener('appinstalled', callback)
  }
}

function getStandaloneSnapshot() {
  if (typeof window === 'undefined') return true
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

function getStandaloneServerSnapshot() {
  return true
}

export default function PWAInstallButton({
  className = '',
  variant = 'badge',
}: PWAInstallButtonProps) {
  const t = useTranslations('pwa')
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot
  )

  if (isStandalone) {
    return null
  }

  const handleClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-pwa-install'))
    }
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer ${className}`}
      >
        <Download className="w-4 h-4" />
        <span>{t('installButton')}</span>
      </button>
    )
  }

  if (variant === 'minimal') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{t('installTitle')}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t('installDesc')}
      className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 text-xs font-semibold tracking-wide uppercase transition-all shadow-sm shadow-amber-500/10 cursor-pointer ${className}`}
    >
      <Download className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
      <span>{t('installTitle')}</span>
      <Sparkles className="w-3 h-3 text-amber-300/80" />
    </button>
  )
}
