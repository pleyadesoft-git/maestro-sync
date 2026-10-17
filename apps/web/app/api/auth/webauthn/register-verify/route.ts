import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import {
  getWebAuthnConfig,
  savePasskeyToUser,
  WEBAUTHN_COOKIE_NAME,
  type WebAuthnChallengeCookie,
  type StoredPasskey,
} from '../../../../../lib/webauthn-server'

export async function POST(req: NextRequest) {
  try {
    const rawCookie = req.cookies.get(WEBAUTHN_COOKIE_NAME)?.value
    if (!rawCookie) {
      return NextResponse.json(
        { ok: false, error: 'Sesión de desafío expirada. Por favor, reintenta el registro.' },
        { status: 400 }
      )
    }

    let challengeData: WebAuthnChallengeCookie
    try {
      challengeData = JSON.parse(rawCookie)
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Desafío de Passkey inválido o corrupto.' },
        { status: 400 }
      )
    }

    if (challengeData.type !== 'register') {
      return NextResponse.json(
        { ok: false, error: 'Tipo de desafío inesperado.' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { response, email, fullName } = body

    if (!response) {
      return NextResponse.json(
        { ok: false, error: 'Respuesta de credencial no recibida del navegador.' },
        { status: 400 }
      )
    }

    const { rpID, origin } = getWebAuthnConfig(req)

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { ok: false, error: 'La verificación criptográfica de la Passkey ha fallado.' },
        { status: 400 }
      )
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo

    const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64url')

    // En RegistrationResponseJSON de @simplewebauthn/browser, transports está en la raíz: response.transports
    const reportedTransports: string[] =
      (Array.isArray(response.transports) && response.transports.length > 0)
        ? response.transports
        : (Array.isArray((response.response as any)?.transports) && (response.response as any).transports.length > 0)
          ? (response.response as any).transports
          : ['internal', 'hybrid']

    const finalTransports = Array.from(
      new Set([...reportedTransports, 'hybrid', 'internal'])
    )

    const newPasskey: StoredPasskey = {
      id: credential.id,
      publicKey: publicKeyBase64,
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: finalTransports,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    }

    const targetEmail = challengeData.email || email
    const supabaseAdmin = createServiceRoleClient()

    const { user } = await savePasskeyToUser(supabaseAdmin, {
      email: targetEmail,
      fullName,
      passkey: newPasskey,
    })

    // Generar token para iniciar sesión automáticamente
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email!,
      })

    if (linkError || !linkData.properties?.hashed_token) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Passkey guardada, pero no se pudo generar la sesión: ' +
            (linkError?.message || 'Error desconocido'),
        },
        { status: 500 }
      )
    }

    const res = NextResponse.json({
      ok: true,
      token_hash: linkData.properties.hashed_token,
      user: {
        id: user.id,
        email: user.email,
      },
    })

    // Limpiar cookie de desafío
    res.cookies.delete(WEBAUTHN_COOKIE_NAME)

    return res
  } catch (err: any) {
    console.error('Error en register-verify:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al verificar registro de Passkey' },
      { status: 500 }
    )
  }
}
