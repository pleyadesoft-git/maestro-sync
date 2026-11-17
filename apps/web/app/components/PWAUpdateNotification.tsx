'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, RefreshCw, X, ArrowUpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

// Extended window type for Workbox & PWA debugging
declare global {
  interface Window {
    workbox?: {
      addEventListener: (event: string, callback: (event: any) => void) => void
      removeEventListener?: (event: string, callback: (event: any) => void) => void
      messageSkipWaiting: () => void
      register: () => Promise<ServiceWorkerRegistration | undefined>
    }
    __triggerPwaUpdateModal?: () => void
    __checkPwaUpdate?: () => Promise<void>
  }
}

export default function PWAUpdateNotification() {
  const t = useTranslations('pwa')
  const pathname = usePathname()
  const [showUpdate, setShowUpdate] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const controllerListenerRef = useRef<(() => void) | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const handleUpdate = useCallback(() => {
    setIsUpdating(true)

    // Ensure we reload when the new service worker takes control
    if ('serviceWorker' in navigator && !controllerListenerRef.current) {
      const onControllerChange = () => {
        window.location.reload()
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
    if (waitingWorker) {
      try {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      } catch (err) {
        console.warn('[PWA] Error posting SKIP_WAITING to waiting worker:', err)
      }
    }

    // Fallback reload in case controllerchange does not fire within 1.5 seconds
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }, [waitingWorker])

  // Trigger update check on active registration
  const checkForUpdate = useCallback(async () => {
    try {
      if (registrationRef.current) {
        await registrationRef.current.update()
      } else if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          registrationRef.current = reg
          await reg.update()
        }
      }
    } catch {
      // Network failure or offline, safe to ignore
    }
  }, [])

  // Check for updates whenever the user navigates between routes
  useEffect(() => {
    if (pathname) {
      checkForUpdate()
    }
  }, [pathname, checkForUpdate])

  useEffect(() => {
    // Expose dev helpers
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
        if (event?.sw) setWaitingWorker(event.sw)
        setShowUpdate(true)
      }
      const onControlling = () => {
        window.location.reload()
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

        // Check if there is already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting)
          setShowUpdate(true)
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
              setWaitingWorker(installingWorker)
              setShowUpdate(true)
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

        // Immediate update check right after ready
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
  }, [checkForUpdate])

  if (!showUpdate) {
    return null
  }

  return (
    <aside
      aria-label={t('updateTitle')}
      role="region"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 border border-amber-500/30 p-5 shadow-2xl shadow-black/80 backdrop-blur-xl ring-1 ring-white/10">
        {/* Glow effect */}
        <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            {isUpdating ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUpCircle className="h-5 w-5 text-amber-400" />
            )}
          </div>

          <div className="flex-1 pr-6">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                {t('updateTitle')}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20">
                <Sparkles className="h-2.5 w-2.5" />
                PWA
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              {t('updateDesc')}
            </p>

            <div className="mt-3 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? t('updating') : t('updateButton')}
              </button>

              <button
                type="button"
                onClick={() => setShowUpdate(false)}
                disabled={isUpdating}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t('updateLater')}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowUpdate(false)}
            aria-label="Cerrar notificación"
            className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
