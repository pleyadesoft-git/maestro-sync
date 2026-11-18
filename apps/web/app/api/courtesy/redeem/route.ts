import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, redeemCourtesyCode } from '@music-flow/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'Introduce un código de cortesía.' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()
    let userId: string | null = null
    let userEmail: string | null = null

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (token) {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token)
      if (!authErr && user) {
        userId = user.id
        userEmail = user.email ?? null
      }
    }

    // Fallback seguro para cuentas recién creadas pendientes de confirmar correo
    if (!userId && typeof body?.userId === 'string' && typeof body?.email === 'string') {
      const { data: userLookup, error: lookupErr } = await supabase.auth.admin.getUserById(
        body.userId
      )
      if (
        !lookupErr &&
        userLookup?.user &&
        userLookup.user.email?.toLowerCase() === body.email.trim().toLowerCase()
      ) {
        userId = userLookup.user.id
        userEmail = userLookup.user.email ?? null
      }
    }

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Debes iniciar sesión o registrarte para canjear un código de cortesía.' },
        { status: 401 }
      )
    }

    const result = await redeemCourtesyCode({
      code,
      userId,
      userEmail,
    })

    if (!result.ok || !result.record) {
      return NextResponse.json(
        { ok: false, error: result.error || 'No se pudo canjear el código de cortesía.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      code: result.record.code,
      planCode: result.record.planCode,
      planName: result.record.planName,
      durationDays: result.record.durationDays,
      periodEnd: result.periodEnd,
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al canjear el código de cortesía.' },
      { status: 500 }
    )
  }
}
