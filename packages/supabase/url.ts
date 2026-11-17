/**
 * Orígenes conocidos y válidos para la plataforma MaestroSync tanto en
 * entornos de desarrollo local como en el VPS de producción.
 */
export const KNOWN_MAESTRO_ORIGINS = [
  'https://maestro-sync.pleyadesoft.com',
  'http://maestro-sync.pleyadesoft.com',
  'https://admin.maestro-sync.pleyadesoft.com',
  'http://admin.maestro-sync.pleyadesoft.com',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3001',
  'http://localhost:3002',
  'https://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
] as const

/**
 * Resuelve el origen público real (protocolo + host) a partir de una petición HTTP
 * o del entorno del navegador, teniendo en cuenta proxies inversos (Nginx, Cloudflare),
 * variables de entorno (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL) y localhost.
 */
export function getPublicOrigin(
  req?: Request | { headers: Headers } | null,
  fallbackPort: number = 3002
): string {
  // 1. En el navegador del cliente:
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  // 2. Si se proporciona una petición en el servidor con encabezados:
  if (req && 'headers' in req) {
    const headers = req.headers
    const forwardedHost = headers.get('x-forwarded-host')
    const forwardedProto = headers.get('x-forwarded-proto')
    const host = forwardedHost || headers.get('host')

    if (host) {
      const isLocal =
        host.startsWith('localhost') ||
        host.startsWith('127.0.0.1') ||
        host.startsWith('0.0.0.0')

      const proto =
        forwardedProto || (isLocal && !host.includes('https') ? 'http' : 'https')

      return `${proto}://${host}`
    }

    const originHeader = headers.get('origin')
    if (originHeader) {
      return originHeader
    }
  }

  // 3. Variables de entorno explícitas
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }

  // 4. Entorno de producción por defecto
  if (process.env.NODE_ENV === 'production') {
    return 'https://maestro-sync.pleyadesoft.com'
  }

  return `http://localhost:${fallbackPort}`
}

/**
 * Obtiene la URL pública del Panel de Administración (apps/admin).
 * Soporta configuración explícita por NEXT_PUBLIC_ADMIN_URL o detección
 * dinámica según el origen actual (localhost:3001 vs admin.maestro-sync.pleyadesoft.com).
 */
export function getAdminPublicUrl(currentOrigin?: string): string {
  if (process.env.NEXT_PUBLIC_ADMIN_URL) {
    return process.env.NEXT_PUBLIC_ADMIN_URL.replace(/\/$/, '')
  }

  const origin =
    currentOrigin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '')

  if (origin) {
    try {
      const url = new URL(origin)
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return `${url.protocol}//${url.hostname}:3001`
      }
      if (url.hostname.includes('maestro-sync.pleyadesoft.com')) {
        return 'https://admin.maestro-sync.pleyadesoft.com'
      }
    } catch {
      /* fallback */
    }
  }

  return process.env.NODE_ENV === 'production'
    ? 'https://admin.maestro-sync.pleyadesoft.com'
    : 'http://localhost:3001'
}

/**
 * Obtiene la URL pública de la aplicación Web principal (apps/web).
 */
export function getWebPublicUrl(currentOrigin?: string): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  const origin =
    currentOrigin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '')

  if (origin) {
    try {
      const url = new URL(origin)
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return `${url.protocol}//${url.hostname}:3002`
      }
      if (url.hostname.includes('maestro-sync.pleyadesoft.com')) {
        return 'https://maestro-sync.pleyadesoft.com'
      }
    } catch {
      /* fallback */
    }
  }

  return process.env.NODE_ENV === 'production'
    ? 'https://maestro-sync.pleyadesoft.com'
    : 'http://localhost:3002'
}

/**
 * Resuelve una URL de redirección segura, asegurando que apunte siempre al origen público
 * actual y evitando que enlaces con localhost queden rotos en producción (o viceversa).
 */
export function resolveSafeRedirectUrl(
  targetPathOrUrl: string | null | undefined,
  publicOrigin: string,
  defaultPath: string = '/es/library'
): URL {
  const fallback = new URL(defaultPath, publicOrigin)
  if (!targetPathOrUrl) return fallback

  try {
    // Si es ruta relativa (ej. /es/library)
    if (targetPathOrUrl.startsWith('/')) {
      return new URL(targetPathOrUrl, publicOrigin)
    }

    // Si es URL absoluta
    const parsed = new URL(targetPathOrUrl)
    const isAllowedDomain =
      parsed.hostname === 'maestro-sync.pleyadesoft.com' ||
      parsed.hostname.endsWith('.pleyadesoft.com') ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'

    if (!isAllowedDomain) {
      return fallback
    }

    // Mantener la ruta interna y search params pero montados sobre publicOrigin
    return new URL(`${parsed.pathname}${parsed.search}`, publicOrigin)
  } catch {
    return fallback
  }
}

/**
 * Lista exhaustiva de orígenes permitidos para validación de WebAuthn / Passkeys.
 */
export function getExpectedWebAuthnOrigins(currentOrigin?: string): string[] {
  const origins = new Set<string>(KNOWN_MAESTRO_ORIGINS)

  if (currentOrigin) {
    origins.add(currentOrigin)
    origins.add(currentOrigin.replace(/\/$/, ''))
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''))
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.add(process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    )
  }

  return Array.from(origins)
}
