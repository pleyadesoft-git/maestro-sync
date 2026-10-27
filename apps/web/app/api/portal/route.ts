import { NextRequest, NextResponse } from 'next/server'
import { getStripeServerInstance } from '@music-flow/stripe'
import { createServiceRoleClient } from '@music-flow/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: 'Sesión no válida o expirada.' }, { status: 401 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('owner_user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      return NextResponse.json(
        { ok: false, error: 'No tienes una suscripción activa con portal de facturación.' },
        { status: 404 }
      )
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
    const stripe = getStripeServerInstance()

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/es/library`,
    })

    return NextResponse.json({ ok: true, url: portalSession.url })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error abriendo portal.' }, { status: 500 })
  }
}
