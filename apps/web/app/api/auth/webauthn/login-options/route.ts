import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import {
  getWebAuthnConfig,
  findUserByEmail,
  WEBAUTHN_COOKIE_NAME,
  type WebAuthnChallengeCookie,
  type StoredPasskey,
} from '../../../../../lib/webauthn-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    const { rpID } = getWebAuthnConfig(req)
    const supabaseAdmin = createServiceRoleClient()

    let allowCredentials: any[] | undefined

    if (email) {
      const user = await findUserByEmail(supabaseAdmin, email)
      if (user) {
        const passkeys = (user.user_metadata?.passkeys || []) as StoredPasskey[]
        if (passkeys.length > 0) {
          allowCredentials = passkeys.map((pk) => {
            const rawTransports = (pk.transports || []) as string[]
            // Incluir explícitamente 'hybrid' e 'internal' para permitir lectura mediante código QR desde móviles
            const transports = Array.from(
              new Set([...rawTransports, 'internal', 'hybrid', 'usb', 'ble'])
            )
            return {
              id: pk.id,
              transports: transports as any,
            }
          })
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      timeout: 120000, // 2 minutos para permitir lectura de QR, conexión BLE y respuesta de relay
      allowCredentials,
    })

    const challengePayload: WebAuthnChallengeCookie = {
      challenge: options.challenge,
      type: 'login',
      email: email || undefined,
      timestamp: Date.now(),
    }

    const res = NextResponse.json({ ok: true, options })

    res.cookies.set({
      name: WEBAUTHN_COOKIE_NAME,
      value: JSON.stringify(challengePayload),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    })

    return res
  } catch (err: any) {
    console.error('Error en login-options:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al generar opciones de inicio con Passkey' },
      { status: 500 }
    )
  }
}
