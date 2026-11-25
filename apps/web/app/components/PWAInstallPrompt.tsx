'use client'

import React, { useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import { Sparkles, Download, X, Share2, PlusSquare, CheckCircle2, Tablet } from 'lucide-react'
import { useTranslations } from 'next-intl'

declare global {
  interface Window {
    __triggerPwaInstallModal?: () => void
    __deferredInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STORAGE_KEY = 'maestro_pwa_install_dismissed'
const SNOOZE_MS = 24 * 60 * 60 * 1000 // 24 hours

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

function subscribeNoop() {
  return () => {}
}

function getIsIOSSnapshot() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isApple =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  const isSafari =
    /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua)
  return isApple && isSafari
}

function isDismissedRecently() {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return false
    const expiry = Number(stored)
    return !isNaN(expiry) && Date.now() < expiry
  } catch {
    return false
  }
}

export default function PWAInstallPrompt() {
  const t = useTranslations('pwa')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [installSuccess, setInstallSuccess] = useState(false)

  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot
  )

  const isIOS = useSyncExternalStore(
    subscribeNoop,
    getIsIOSSnapshot,
    () => false
  )

  // Listen to install prompt events and manual triggers
  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone) return

    // Pick up beforeinstallprompt if it fired before React hydration
    let earlyPromptTimer: ReturnType<typeof setTimeout> | null = null
    if (window.__deferredInstallPrompt) {
      const captured = window.__deferredInstallPrompt
      earlyPromptTimer = setTimeout(() => {
        setDeferredPrompt(captured)
        if (!isDismissedRecently()) {
          setShowPrompt(true)
        }
      }, 0)
    }

    // Standard PWA install event (Chromium, Android, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      window.__deferredInstallPrompt = promptEvent
      setDeferredPrompt(promptEvent)

      if (!isDismissedRecently()) {
        setShowPrompt(true)
      }
    }

    // Manual trigger event from button/UI
    const handleManualTrigger = () => {
      setShowPrompt(true)
    }

    // Dev preview helper
    window.__triggerPwaInstallModal = () => setShowPrompt(true)

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('open-pwa-install', handleManualTrigger)

    // On iOS Safari, show gently after 3 seconds if not dismissed
    let iosTimer: NodeJS.Timeout | null = null
    if (isIOS && !isDismissedRecently()) {
      iosTimer = setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('open-pwa-install', handleManualTrigger)
      if (earlyPromptTimer) clearTimeout(earlyPromptTimer)
      if (iosTimer) clearTimeout(iosTimer)
      delete window.__triggerPwaInstallModal
    }
  }, [isStandalone, isIOS])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + SNOOZE_MS))
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) {
      if (isIOS) return
      return
    }

    setIsInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setInstallSuccess(true)
        setTimeout(() => {
          setShowPrompt(false)
          setInstallSuccess(false)
        }, 2500)
      } else {
        handleDismiss()
      }
    } catch (err) {
      console.error('[PWA] Error launching install prompt:', err)
    } finally {
      setIsInstalling(false)
      setDeferredPrompt(null)
      if (typeof window !== 'undefined') {
        window.__deferredInstallPrompt = null
      }
    }
  }, [deferredPrompt, isIOS, handleDismiss])

  // Don't render anything if already installed in standalone mode or hidden
  if (isStandalone || !showPrompt) {
    return null
  }

  return (
    <aside
      aria-label={t('installStandTitle')}
      role="region"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-top-5 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 border border-amber-500/30 p-5 shadow-2xl shadow-black/80 backdrop-blur-xl ring-1 ring-white/10">
        {/* Glow effect */}
        <div className="absolute -top-12 -left-12 h-28 w-28 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />

        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            {installSuccess ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400 animate-bounce" />
            ) : isIOS ? (
              <Tablet className="h-6 w-6 text-amber-400" />
            ) : (
              <Download className="h-6 w-6 text-amber-400" />
            )}
          </div>

          <div className="flex-1 pr-5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                {installSuccess ? t('installedSuccess') : t('installStandTitle')}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20">
                <Sparkles className="h-2.5 w-2.5" />
                {t('badgePwa')}
              </span>
            </div>

            {installSuccess ? (
              <p className="mt-1.5 text-xs text-emerald-400 font-medium">
                {t('installedDetail')}
              </p>
            ) : isIOS ? (
              <div className="mt-2 text-xs text-slate-300 space-y-2">
                <p className="text-slate-400 leading-relaxed">
                  {t('iosSubtitle')}
                </p>
                <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                      1
                    </span>
                    <span>
                      {t('iosStep1')}{' '}
                      <Share2 className="inline h-3.5 w-3.5 text-amber-400 align-text-bottom" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                      2
                    </span>
                    <span>
                      {t('iosStep2')}{' '}
                      <PlusSquare className="inline h-3.5 w-3.5 text-amber-400 align-text-bottom" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                      3
                    </span>
                    <span>{t('iosStep3')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  {t('installDesc')}
                </p>

                {!deferredPrompt && (
                  <p className="mt-2 rounded-lg bg-slate-950/60 border border-slate-800 px-2.5 py-2 text-[11px] text-slate-300 leading-relaxed">
                    {t('manualInstallFallback')}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2.5">
                  {deferredPrompt && (
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      disabled={isInstalling}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Download className={`h-3.5 w-3.5 ${isInstalling ? 'animate-bounce' : ''}`} />
                      {isInstalling ? t('installing') : t('installButton')}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {t('dismiss')}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('closeInstallAria')}
            className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
