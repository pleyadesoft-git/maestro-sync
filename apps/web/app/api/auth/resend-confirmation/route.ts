import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import { findUserByEmail } from '../../../../lib/webauthn-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const locale = typeof body?.locale === 'string' ? body.locale : 'es'

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Por favor introduce un correo electrónico válido.' },
        { status: 400 }
      )
    }

    const host =
      req.headers.get('x-forwarded-host') ||
      req.headers.get('host') ||
      'localhost:3002'
    const proto =
      req.headers.get('x-forwarded-proto') ||
      (host.startsWith('localhost') ? 'http' : 'https')
    const origin = req.headers.get('origin') || `${proto}://${host}`
    const redirectTo = `${origin}/auth/confirm?next=/${locale}/library`

    const supabaseAdmin = createServiceRoleClient()
    const user = await findUserByEmail(supabaseAdmin, email)

    if (user && user.email_confirmed_at) {
      return NextResponse.json({
        ok: true,
        alreadyConfirmed: true,
        message: 'Esta cuenta ya está confirmada. Puedes iniciar sesión directamente.',
      })
    }

    // Usar resend de Supabase con el redirect URL adecuado
    const { error } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      if (
        error.message.toLowerCase().includes('rate limit') ||
        error.message.toLowerCase().includes('over_email_send_rate_limit')
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Has alcanzado el límite temporal de envío de correos. Por favor espera unos minutos antes de volver a solicitarlo.',
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Correo de confirmación reenviado. Por favor revisa tu bandeja y spam.',
    })
  } catch (err: any) {
    console.error('Error en resend-confirmation:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al reenviar correo de confirmación' },
      { status: 500 }
    )
  }
}
