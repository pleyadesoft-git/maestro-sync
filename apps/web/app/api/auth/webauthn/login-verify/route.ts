import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import {
  getWebAuthnConfig,
  findUserByPasskeyId,
  findUserByEmail,
  updatePasskeyUsage,
  WEBAUTHN_COOKIE_NAME,
  type WebAuthnChallengeCookie,
  type StoredPasskey,
} from '../../../../../lib/webauthn-server'

export async function POST(req: NextRequest) {
  try {
    const rawCookie = req.cookies.get(WEBAUTHN_COOKIE_NAME)?.value
    if (!rawCookie) {
      return NextResponse.json(
        { ok: false, error: 'Sesión de desafío expirada. Por favor, intenta de nuevo.' },
        { status: 400 }
      )
    }

    let challengeData: WebAuthnChallengeCookie
    try {
      challengeData = JSON.parse(rawCookie)
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Desafío de Passkey corrupto o inválido.' },
        { status: 400 }
      )
    }

    if (challengeData.type !== 'login') {
      return NextResponse.json(
        { ok: false, error: 'Tipo de desafío inesperado.' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { response } = body

    if (!response || !response.id) {
      return NextResponse.json(
        { ok: false, error: 'No se recibió la credencial del navegador.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceRoleClient()
    const { rpID, origin } = getWebAuthnConfig(req)

    let targetUser: any = null
    let targetPasskey: StoredPasskey | null = null

    // Si había email en el desafío, buscar primero en ese usuario
    if (challengeData.email) {
      targetUser = await findUserByEmail(supabaseAdmin, challengeData.email)
      if (targetUser) {
        const passkeys = (targetUser.user_metadata?.passkeys || []) as StoredPasskey[]
        targetPasskey = passkeys.find((pk) => pk.id === response.id) || null
      }
    }

    // Si no se encontró por email o era una credencial residente, buscar por passkey.id
    if (!targetPasskey) {
      const match = await findUserByPasskeyId(supabaseAdmin, response.id)
      if (match) {
        targetUser = match.user
        targetPasskey = match.passkey
      }
    }

    if (!targetUser || !targetPasskey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Esta Passkey no está vinculada a ninguna cuenta en MaestroSync. Primero regístrate o vincúlala en tu perfil.',
        },
        { status: 404 }
      )
    }

    const publicKeyBytes = new Uint8Array(
      Buffer.from(targetPasskey.publicKey, 'base64url')
    )

    const expectedOrigins = Array.from(
      new Set([origin, 'http://localhost:3002', 'https://localhost:3002'])
    )

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      credential: {
        id: targetPasskey.id,
        publicKey: publicKeyBytes,
        counter: targetPasskey.counter,
        transports: targetPasskey.transports as any,
      },
      requireUserVerification: true,
    })

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, error: 'La firma criptográfica de la Passkey es inválida.' },
        { status: 400 }
      )
    }

    // Actualizar contador y timestamp
    await updatePasskeyUsage(
      supabaseAdmin,
      targetUser.id,
      targetPasskey.id,
      verification.authenticationInfo.newCounter
    )

    // Generar enlace / token de sesión
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: targetUser.email!,
      })

    if (linkError || !linkData.properties?.hashed_token) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Passkey verificada con éxito, pero falló la emisión de sesión: ' +
            (linkError?.message || 'Error desconocido'),
        },
        { status: 500 }
      )
    }

    const res = NextResponse.json({
      ok: true,
      token_hash: linkData.properties.hashed_token,
      user: {
        id: targetUser.id,
        email: targetUser.email,
      },
    })

    // Limpiar cookie de desafío
    res.cookies.delete(WEBAUTHN_COOKIE_NAME)

    return res
  } catch (err: any) {
    console.error('Error en login-verify:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al validar Passkey' },
      { status: 500 }
    )
  }
}
