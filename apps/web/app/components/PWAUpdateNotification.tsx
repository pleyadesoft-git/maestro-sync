'use client'

import React, { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, RefreshCw, X, ArrowUpCircle, WifiOff, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePlaybackStore } from '@music-flow/stores'
import {
  getPwaUpdateMode,
  getPwaUpdateModeServerSnapshot,
  setPwaUpdateMode,
  subscribePwaUpdateMode,
  canAutoReloadNow,
  markAutoReloaded,
  subscribeOnline,
  getOnlineSnapshot,
} from '../../lib/pwa'

// Extended window type for Workbox & PWA helpers
declare global {
  interface Window {
    workbox?: {
      addEventListener: (event: string, callback: (event: any) => void) => void
      removeEventListener?: (event: string, callback: (event: any) => void) => void
      messageSkipWaiting: () => void
      register: () => Promise<ServiceWorkerRegistration | undefined>
    }
    __triggerPwaUpdateModal?: () => void
    __checkPwaUpdate?: () => Promise<boolean>
  }
}

export default function PWAUpdateNotification() {
  const t = useTranslations('pwa')
  const pathname = usePathname()
  const playbackStatus = usePlaybackStore((s) => s.status)

  const updateMode = useSyncExternalStore(
    subscribePwaUpdateMode,
    getPwaUpdateMode,
    getPwaUpdateModeServerSnapshot
  )
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true)

  const [showUpdate, setShowUpdate] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isAutoUpdating, setIsAutoUpdating] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  const waitingWorkerRef = useRef<ServiceWorker | null>(null)
  const controllerListenerRef = useRef<(() => void) | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const reloadingRef = useRef(false)

  const isInActiveLiveSession =
    Boolean(pathname?.includes('/session/')) && playbackStatus === 'playing'

  const triggerReloadOnce = useCallback(() => {
    if (reloadingRef.current) return
    reloadingRef.current = true
    window.location.reload()
  }, [])

  const applyUpdate = useCallback(
    (workerOverride?: ServiceWorker | null, isAuto = false) => {
      if (reloadingRef.current) return

      const targetWorker = workerOverride ?? waitingWorkerRef.current
      if (isAuto) {
        markAutoReloaded()
        setIsAutoUpdating(true)
      }
      setIsUpdating(true)
      setShowUpdate(true)

      // Ensure we reload when the new service worker takes control
      if ('serviceWorker' in navigator && !controllerListenerRef.current) {
        const onControllerChange = () => {
          triggerReloadOnce()
        }
        controllerListenerRef.current = onControllerChange
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
      }

      // Trigger skip waiting via Workbox if available
      if (window.workbox && typeof window.workbox.messageSkipWaiting === 'function') {
        try {
          window.workbox.messageSkipWaiting()
        } catch (err) {
          console.warn('[PWA] Error calling workbox.messageSkipWaiting():', err)
        }
      }

      // Also send SKIP_WAITING directly to the waiting worker as a failsafe
      if (targetWorker) {
        try {
          targetWorker.postMessage({ type: 'SKIP_WAITING' })
        } catch (err) {
          console.warn('[PWA] Error posting SKIP_WAITING to waiting worker:', err)
        }
      }

      // Fallback reload in case controllerchange does not fire within 1.5 seconds
      setTimeout(() => {
        triggerReloadOnce()
      }, 1500)
    },
    [triggerReloadOnce]
  )

  const handleUpdateDetected = useCallback(
    (worker: ServiceWorker | null) => {
      if (worker) {
        waitingWorkerRef.current = worker
        setWaitingWorker(worker)
      }

      const mode = getPwaUpdateMode()
      const livePlaying =
        typeof window !== 'undefined' &&
        window.location.pathname.includes('/session/') &&
        usePlaybackStore.getState().status === 'playing'

      if (mode === 'auto' && !livePlaying && canAutoReloadNow()) {
        applyUpdate(worker, true)
      } else {
        setShowUpdate(true)
      }
    },
    [applyUpdate]
  )

  // If auto-update is enabled and a waiting worker was deferred during a live session,
  // automatically apply it as soon as playback pauses/stops or the user leaves the session.
  useEffect(() => {
    if (
      updateMode === 'auto' &&
      waitingWorker &&
      !isInActiveLiveSession &&
      !isUpdating &&
      canAutoReloadNow()
    ) {
      const timer = setTimeout(() => {
        applyUpdate(waitingWorker, true)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [updateMode, waitingWorker, isInActiveLiveSession, isUpdating, applyUpdate])

  // Trigger update check on active registration; returns true if an update is waiting or installing
  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    try {
      let reg = registrationRef.current
      if (!reg && 'serviceWorker' in navigator) {
        reg = (await navigator.serviceWorker.getRegistration()) ?? null
        if (reg) registrationRef.current = reg
      }
      if (!reg) return false

      await reg.update()

      if (reg.waiting) {
        handleUpdateDetected(reg.waiting)
        return true
      }

      if (reg.installing) {
        return true
      }

      return false
    } catch {
      // Network failure or offline, safe to ignore
      return false
    }
  }, [handleUpdateDetected])

  // Check for updates whenever the user navigates between routes
  useEffect(() => {
    if (pathname) {
      void checkForUpdate()
    }
  }, [pathname, checkForUpdate])

  useEffect(() => {
    // Expose helpers for UI controls & dev debugging
    window.__triggerPwaUpdateModal = () => setShowUpdate(true)
    window.__checkPwaUpdate = checkForUpdate

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    let disposed = false
    const cleanups: Array<() => void> = []

    // 1. Workbox event listener if next-pwa workbox is loaded
    if (window.workbox) {
      const onWaiting = (event: any) => {
        handleUpdateDetected(event?.sw ?? null)
      }
      const onControlling = () => {
        triggerReloadOnce()
      }
      window.workbox.addEventListener('waiting', onWaiting)
      window.workbox.addEventListener('controlling', onControlling)
      cleanups.push(() => {
        window.workbox?.removeEventListener?.('waiting', onWaiting)
        window.workbox?.removeEventListener?.('controlling', onControlling)
      })
    }

    // 2. Native ServiceWorker listeners for robust update detection
    navigator.serviceWorker.ready
      .then((registration) => {
        if (disposed) return
        registrationRef.current = registration

        // Check if there is already a waiting worker on entry
        if (registration.waiting) {
          handleUpdateDetected(registration.waiting)
        }

        // Detect new service worker installing
        const onUpdateFound = () => {
          const installingWorker = registration.installing
          if (!installingWorker) return

          const onStateChange = () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New content is available and waiting
              handleUpdateDetected(installingWorker)
            }
          }
          installingWorker.addEventListener('statechange', onStateChange)
          cleanups.push(() =>
            installingWorker.removeEventListener('statechange', onStateChange)
          )
        }
        registration.addEventListener('updatefound', onUpdateFound)
        cleanups.push(() =>
          registration.removeEventListener('updatefound', onUpdateFound)
        )

        // Immediate update check right after ready (on app entry)
        registration.update().catch(() => {})

        // Check periodically (every 3 minutes)
        const interval = setInterval(() => {
          registration.update().catch(() => {})
        }, 3 * 60 * 1000)
        cleanups.push(() => clearInterval(interval))

        // Check when user returns to the tab/app
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        cleanups.push(() =>
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        )

        // Check on window focus
        const handleFocus = () => {
          registration.update().catch(() => {})
        }
        window.addEventListener('focus', handleFocus)
        cleanups.push(() => window.removeEventListener('focus', handleFocus))

        // Check when device comes back online
        const handleOnline = () => {
          registration.update().catch(() => {})
        }
        window.addEventListener('online', handleOnline)
        cleanups.push(() => window.removeEventListener('online', handleOnline))
      })
      .catch(() => {})

    return () => {
      disposed = true
      for (const cleanup of cleanups.splice(0)) cleanup()
      if (controllerListenerRef.current) {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          controllerListenerRef.current
        )
        controllerListenerRef.current = null
      }
      delete window.__triggerPwaUpdateModal
      delete window.__checkPwaUpdate
    }
  }, [checkForUpdate, handleUpdateDetected, triggerReloadOnce])

  const handleToggleAutoUpdate = () => {
    const nextMode = updateMode === 'auto' ? 'notify' : 'auto'
    setPwaUpdateMode(nextMode)
  }

  return (
    <>
      {/* Subtle Stand-Ready offline indicator */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900/95 border border-amber-500/40 px-3.5 py-2 text-xs font-medium text-amber-300 shadow-lg shadow-black/60 backdrop-blur-md"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span>{t('offlineBanner')}</span>
        </div>
      )}

      {/* Update Notification / Auto-Updating Banner */}
      {showUpdate && (
        <aside
          aria-label={isAutoUpdating ? t('autoUpdatingTitle') : t('updateTitle')}
          role="region"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 border border-amber-500/30 p-5 shadow-2xl shadow-black/80 backdrop-blur-xl ring-1 ring-white/10">
            {/* Glow effect */}
            <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                {isUpdating ? (
                  <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUpCircle className="h-5 w-5 text-amber-400" aria-hidden="true" />
                )}
              </div>

              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {isAutoUpdating ? t('autoUpdatingTitle') : t('updateTitle')}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20">
                    <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                    PWA
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {isAutoUpdating
                    ? t('autoUpdatingDesc')
                    : updateMode === 'auto' && isInActiveLiveSession
                      ? t('updateDeferredSession')
                      : t('updateDesc')}
                </p>

                {!isAutoUpdating && (
                  <>
                    <div className="mt-3 flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => applyUpdate(waitingWorker, false)}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        {isUpdating ? t('updating') : t('updateButton')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowUpdate(false)}
                        disabled={isUpdating}
                        className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {t('updateLater')}
                      </button>
                    </div>

                    {/* Quick toggle for automatic updates */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Zap className="h-3 w-3 text-amber-400 shrink-0" aria-hidden="true" />
                        <span>{t('autoUpdateLabel')}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={updateMode === 'auto'}
                        aria-label={t('autoUpdateLabel')}
                        onClick={handleToggleAutoUpdate}
                        disabled={isUpdating}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          updateMode === 'auto' ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                            updateMode === 'auto' ? 'translate-x-4.5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!isAutoUpdating && (
                <button
                  type="button"
                  onClick={() => setShowUpdate(false)}
                  aria-label={t('closeUpdateAria')}
                  className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  )
}
