export type PwaUpdateMode = 'notify' | 'auto'

const UPDATE_MODE_KEY = 'maestro_pwa_update_mode'
const AUTO_RELOAD_TS_KEY = 'maestro_pwa_last_auto_reload'
const UPDATE_MODE_EVENT = 'maestro-pwa-update-mode-changed'
const AUTO_RELOAD_COOLDOWN_MS = 30 * 1000

export function getPwaUpdateMode(): PwaUpdateMode {
  if (typeof window === 'undefined') return 'notify'
  try {
    const val = localStorage.getItem(UPDATE_MODE_KEY)
    return val === 'auto' ? 'auto' : 'notify'
  } catch {
    return 'notify'
  }
}

export function getPwaUpdateModeServerSnapshot(): PwaUpdateMode {
  return 'notify'
}

export function setPwaUpdateMode(mode: PwaUpdateMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(UPDATE_MODE_KEY, mode)
  } catch {
    // Ignore storage errors (private browsing / quota)
  }
  window.dispatchEvent(new CustomEvent(UPDATE_MODE_EVENT, { detail: mode }))
}

export function subscribePwaUpdateMode(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === UPDATE_MODE_KEY) callback()
  }
  window.addEventListener(UPDATE_MODE_EVENT, callback)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(UPDATE_MODE_EVENT, callback)
    window.removeEventListener('storage', onStorage)
  }
}

export function canAutoReloadNow(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(AUTO_RELOAD_TS_KEY)
    if (!raw) return true
    const lastTs = Number(raw)
    return Number.isNaN(lastTs) || Date.now() - lastTs > AUTO_RELOAD_COOLDOWN_MS
  } catch {
    return true
  }
}

export function markAutoReloaded(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(AUTO_RELOAD_TS_KEY, String(Date.now()))
  } catch {
    // Ignore storage errors
  }
}

export function subscribeStandalone(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia('(display-mode: standalone)')
  mql.addEventListener('change', callback)
  window.addEventListener('appinstalled', callback)
  return () => {
    mql.removeEventListener('change', callback)
    window.removeEventListener('appinstalled', callback)
  }
}

export function getStandaloneSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

export function subscribeOnline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export function getOnlineSnapshot(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}
