import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
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
    const { email, fullName } = body

    // También verificamos si el usuario ya está autenticado con Bearer token
    let authenticatedUser: any = null
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    const supabaseAdmin = createServiceRoleClient()

    if (token) {
      const { data: authData } = await supabaseAdmin.auth.getUser(token)
      if (authData?.user) {
        authenticatedUser = authData.user
      }
    }

    const effectiveEmail =
      authenticatedUser?.email || (typeof email === 'string' ? email.trim().toLowerCase() : '')

    if (!effectiveEmail) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere un correo electrónico para registrar la Passkey.' },
        { status: 400 }
      )
    }

    const effectiveName =
      fullName?.trim() ||
      authenticatedUser?.user_metadata?.full_name ||
      effectiveEmail.split('@')[0]

    // Revisar si el usuario ya existe para listar credenciales
    const existingUser =
      authenticatedUser || (await findUserByEmail(supabaseAdmin, effectiveEmail))

    const existingPasskeys = (existingUser?.user_metadata?.passkeys || []) as StoredPasskey[]
    // Nota: Incluimos tanto 'internal' como 'hybrid' para no bloquear autenticadores cruzados
    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: pk.id,
      transports: Array.from(
        new Set([...(pk.transports || []), 'internal', 'hybrid'])
      ) as any,
    }))

    const { rpID, rpName } = getWebAuthnConfig(req)
    const userIdBuffer = new Uint8Array(
      Buffer.from(existingUser?.id || `new_${effectiveEmail}`)
    )

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdBuffer,
      userName: effectiveEmail,
      userDisplayName: effectiveName,
      attestationType: 'none',
      excludeCredentials,
      timeout: 120000, // 2 minutos para permitir escaneo de QR y emparejamiento Bluetooth
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        // NO restringir a 'platform' para permitir el flujo híbrido de código QR con teléfono
      },
    })

    const challengePayload: WebAuthnChallengeCookie = {
      challenge: options.challenge,
      type: 'register',
      email: effectiveEmail,
      userId: existingUser?.id,
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
      maxAge: 300, // 5 minutos
    })

    return res
  } catch (err: any) {
    console.error('Error en register-options:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al generar opciones de Passkey' },
      { status: 500 }
    )
  }
}
