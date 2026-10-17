import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'
import { createBrowserClient } from '@music-flow/supabase'

export interface WebAuthnAuthResult {
  ok: boolean
  user?: { id: string; email?: string }
  error?: string
  cancelled?: boolean
}

/**
 * Comprueba si el navegador actual soporta WebAuthn / Passkeys.
 */
export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false
  return browserSupportsWebAuthn()
}

/**
 * Comprueba si el dispositivo cuenta con un autenticador biométrico local
 * (Face ID, Touch ID, Windows Hello).
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Registro de nueva cuenta o vinculación de Passkey / Biometría.
 */
export async function performWebAuthnRegister(params: {
  email: string
  fullName?: string
}): Promise<WebAuthnAuthResult> {
  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      error: 'Tu navegador no soporta Passkeys o WebAuthn.',
    }
  }

  const supabase = createBrowserClient()

  try {
    // 1. Obtener opciones del servidor
    const resOptions = await fetch('/api/auth/webauthn/register-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        fullName: params.fullName,
      }),
    })

    const dataOptions = await resOptions.json()
    if (!resOptions.ok || !dataOptions.ok) {
      return {
        ok: false,
        error: dataOptions.error || 'No se pudieron generar las opciones de Passkey.',
      }
    }

    // 2. Invocar la ceremonia nativa del navegador (Touch ID / Face ID)
    let registrationResponse: any
    try {
      registrationResponse = await startRegistration({
        optionsJSON: dataOptions.options,
      })
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || ''
      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'AbortError' ||
        msg.includes('cancel')
      ) {
        return { ok: false, cancelled: true }
      }
      if (err?.name === 'TimeoutError' || msg.includes('timeout') || msg.includes('timed out')) {
        return {
          ok: false,
          error:
            'Tiempo de espera agotado. Si usas el código QR con tu móvil, asegúrate de tener Bluetooth activado en ambos dispositivos y mantenerlos cerca.',
        }
      }
      return {
        ok: false,
        error: err?.message || 'Error durante la verificación biométrica del dispositivo.',
      }
    }

    // 3. Enviar attestation al servidor para verificar y guardar
    const resVerify = await fetch('/api/auth/webauthn/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: registrationResponse,
        email: params.email,
        fullName: params.fullName,
      }),
    })

    const dataVerify = await resVerify.json()
    if (!resVerify.ok || !dataVerify.ok) {
      return {
        ok: false,
        error: dataVerify.error || 'Falló la verificación del registro de Passkey.',
      }
    }

    // 4. Intercambiar token_hash para establecer sesión real en Supabase Browser Client
    const { token_hash, user } = dataVerify
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'magiclink',
    })

    if (otpError) {
      return {
        ok: false,
        error: 'Passkey registrada, pero falló el inicio de sesión: ' + otpError.message,
      }
    }

    return {
      ok: true,
      user,
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Error inesperado durante el registro con Passkey.',
    }
  }
}

/**
 * Autenticación e inicio de sesión en un toque con Passkey / Biometría.
 */
export async function performWebAuthnLogin(params?: {
  email?: string
}): Promise<WebAuthnAuthResult> {
  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      error: 'Tu navegador no soporta Passkeys o WebAuthn.',
    }
  }

  const supabase = createBrowserClient()

  try {
    // 1. Obtener opciones del servidor
    const resOptions = await fetch('/api/auth/webauthn/login-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params?.email,
      }),
    })

    const dataOptions = await resOptions.json()
    if (!resOptions.ok || !dataOptions.ok) {
      return {
        ok: false,
        error: dataOptions.error || 'No se pudieron obtener las opciones de inicio con Passkey.',
      }
    }

    // 2. Invocar Touch ID / Face ID / Selector de Passkeys
    let authenticationResponse: any
    try {
      authenticationResponse = await startAuthentication({
        optionsJSON: dataOptions.options,
      })
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || ''
      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'AbortError' ||
        msg.includes('cancel')
      ) {
        return { ok: false, cancelled: true }
      }
      if (err?.name === 'TimeoutError' || msg.includes('timeout') || msg.includes('timed out')) {
        return {
          ok: false,
          error:
            'Tiempo de espera agotado. Si usas el código QR con tu móvil, asegúrate de tener Bluetooth activado en ambos dispositivos y mantenerlos cerca.',
        }
      }
      return {
        ok: false,
        error: err?.message || 'Biometría cancelada o no reconocida.',
      }
    }

    // 3. Enviar assertion al servidor para validar y firmar sesión
    const resVerify = await fetch('/api/auth/webauthn/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: authenticationResponse,
      }),
    })

    const dataVerify = await resVerify.json()
    if (!resVerify.ok || !dataVerify.ok) {
      return {
        ok: false,
        error: dataVerify.error || 'No se pudo autenticar la Passkey.',
      }
    }

    // 4. Intercambiar token_hash con Supabase Browser Client
    const { token_hash, user } = dataVerify
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'magiclink',
    })

    if (otpError) {
      return {
        ok: false,
        error: 'Passkey confirmada pero falló la sesión: ' + otpError.message,
      }
    }

    return {
      ok: true,
      user,
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Error inesperado al iniciar sesión con Passkey.',
    }
  }
}
