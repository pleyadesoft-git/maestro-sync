'use client'

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { RefreshCw, Bell, Zap, CheckCircle2, Smartphone, Wifi, WifiOff, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  getPwaUpdateMode,
  getPwaUpdateModeServerSnapshot,
  setPwaUpdateMode,
  subscribePwaUpdateMode,
  subscribeStandalone,
  getStandaloneSnapshot,
  subscribeOnline,
  getOnlineSnapshot,
  type PwaUpdateMode,
} from '../../lib/pwa'

type CheckState = 'idle' | 'checking' | 'upToDate' | 'found'

export default function PWAUpdateSettingsButton({ className = '' }: { className?: string }) {
  const t = useTranslations('pwa')
  const [open, setOpen] = useState(false)
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const containerRef = useRef<HTMLDivElement>(null)

  const updateMode = useSyncExternalStore(
    subscribePwaUpdateMode,
    getPwaUpdateMode,
    getPwaUpdateModeServerSnapshot
  )
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    () => false
  )
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelectMode = (mode: PwaUpdateMode) => {
    setPwaUpdateMode(mode)
  }

  const handleCheckNow = async () => {
    if (checkState === 'checking') return
    setCheckState('checking')
    try {
      let found = false
      if (typeof window !== 'undefined' && typeof window.__checkPwaUpdate === 'function') {
        found = await window.__checkPwaUpdate()
      } else if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          await reg.update()
          found = Boolean(reg.waiting || reg.installing)
        }
      }
      setCheckState(found ? 'found' : 'upToDate')
      setTimeout(() => {
        setCheckState('idle')
      }, 4000)
    } catch {
      setCheckState('upToDate')
      setTimeout(() => setCheckState('idle'), 3000)
    }
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t('updateSettingsTitle')}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700/80 bg-slate-900/90 hover:border-amber-500/40 hover:bg-slate-800/90 text-slate-300 hover:text-amber-300 text-xs font-medium transition-all cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
        <span>{t('updateSettingsButton')}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            updateMode === 'auto'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          }`}
        >
          {updateMode === 'auto' ? t('autoUpdateShort') : 'Notify'}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('updateSettingsTitle')}
          className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2.5 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900/98 border border-slate-700/80 p-4 shadow-2xl shadow-black/80 backdrop-blur-xl ring-1 ring-white/10 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100">
              {t('updateSettingsTitle')}
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('closeUpdateAria')}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Status pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700 px-2.5 py-1 text-slate-300">
              <Smartphone className="h-3 w-3 text-amber-400" aria-hidden="true" />
              {isStandalone ? t('statusInstalled') : t('statusBrowser')}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
                isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
              }`}
            >
              {isOnline ? (
                <Wifi className="h-3 w-3" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3 w-3" aria-hidden="true" />
              )}
              {isOnline ? t('statusOnline') : t('statusOffline')}
            </span>
          </div>

          {/* Mode selector */}
          <div className="mt-3.5 space-y-2" role="radiogroup" aria-label={t('updateSettingsTitle')}>
            <button
              type="button"
              role="radio"
              aria-checked={updateMode === 'notify'}
              onClick={() => handleSelectMode('notify')}
              className={`w-full text-left rounded-xl p-3 border transition-all cursor-pointer ${
                updateMode === 'notify'
                  ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Bell
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    updateMode === 'notify' ? 'text-amber-400' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">
                      {t('updateModeNotifyTitle')}
                    </span>
                    {updateMode === 'notify' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    {t('updateModeNotifyDesc')}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={updateMode === 'auto'}
              onClick={() => handleSelectMode('auto')}
              className={`w-full text-left rounded-xl p-3 border transition-all cursor-pointer ${
                updateMode === 'auto'
                  ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Zap
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    updateMode === 'auto' ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">
                      {t('updateModeAutoTitle')}
                    </span>
                    {updateMode === 'auto' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    {t('updateModeAutoDesc')}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Manual check button */}
          <div className="mt-3.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCheckNow}
              disabled={checkState === 'checking' || !isOnline}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-700/80 text-slate-100 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-amber-400 ${
                  checkState === 'checking' ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
              <span>
                {checkState === 'checking'
                  ? t('checkingUpdates')
                  : checkState === 'found'
                    ? t('updateFound')
                    : checkState === 'upToDate'
                      ? t('upToDate')
                      : t('checkForUpdates')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
