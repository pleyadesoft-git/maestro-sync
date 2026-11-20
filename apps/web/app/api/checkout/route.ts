import { NextRequest, NextResponse } from 'next/server'
import { getStripeServerInstance, PLANS_CONFIG } from '@music-flow/stripe'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import { getPublicOrigin } from '@music-flow/supabase'

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

    const body = await req.json()
    const { planCode, interval = 'month', ensembleName } = body
    let normalizedPlanCode = planCode
    if (normalizedPlanCode === 'individual_monthly') normalizedPlanCode = 'solo_monthly'
    if (normalizedPlanCode === 'individual_annual') normalizedPlanCode = 'solo_annual'
    if (normalizedPlanCode === 'individual') normalizedPlanCode = interval === 'year' ? 'solo_annual' : 'solo_monthly'
    if (normalizedPlanCode === 'solo') normalizedPlanCode = interval === 'year' ? 'solo_annual' : 'solo_monthly'
    if (normalizedPlanCode === 'band') normalizedPlanCode = interval === 'year' ? 'band_annual' : 'band_monthly'
    if (normalizedPlanCode === 'orchestra') normalizedPlanCode = interval === 'year' ? 'orchestra_annual' : 'orchestra_monthly'

    const planKey = Object.keys(PLANS_CONFIG).find(
      (k) => (PLANS_CONFIG as any)[k].code === normalizedPlanCode
    )
    if (!planKey) {
      return NextResponse.json({ ok: false, error: 'Plan seleccionado inválido.' }, { status: 400 })
    }
    const planConfig = (PLANS_CONFIG as any)[planKey]

    if (
      planConfig.code === 'free' ||
      !planConfig.interval ||
      typeof planConfig.priceCents !== 'number' ||
      planConfig.priceCents <= 0
    ) {
      return NextResponse.json(
        { ok: false, error: 'El plan gratuito no requiere checkout en Stripe.' },
        { status: 400 }
      )
    }

    const stripe = getStripeServerInstance()

    // 1. Obtener o crear cliente en Stripe
    let customerId: string | null = null
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('owner_user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .maybeSingle()

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      })
      customerId = customer.id
    }

    // 2. Preparar metadatos de ensamble para crear la organización solo al completarse el pago en el webhook
    const orgName = planConfig.ensembleType
      ? (ensembleName || '').trim() || (planConfig.ensembleType === 'band' ? 'Mi Banda' : 'Mi Orquesta')
      : ''

    const checkoutMetadata: Record<string, string> = {
      user_id: user.id,
      plan_code: planConfig.code,
    }
    if (planConfig.ensembleType) {
      checkoutMetadata.ensemble_type = planConfig.ensembleType
      checkoutMetadata.ensemble_name = orgName
      if (planConfig.maxMembers != null) {
        checkoutMetadata.max_members = String(planConfig.maxMembers)
      }
    }

    const origin = getPublicOrigin(req, 3002)
    const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value
    const locale = cookieLocale === 'en' ? 'en' : 'es'

    // 3. Crear sesión de Stripe Checkout con precio e intervalo estrictamente del planConfig
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planConfig.name,
              description: planConfig.ensembleType
                ? locale === 'en'
                  ? `${planConfig.name} plan for musical ensemble direction`
                  : `Plan ${planConfig.name} para dirección de ensamble musical`
                : locale === 'en'
                  ? 'Personal subscription for solo musician'
                  : 'Suscripción personal para músico solista',
            },
            unit_amount: planConfig.priceCents,
            recurring: {
              interval: planConfig.interval === 'year' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: checkoutMetadata,
      },
      metadata: checkoutMetadata,
      success_url: `${origin}/${locale}/library?success=subscription_created`,
      cancel_url: `${origin}/${locale}/pricing?cancelled=true`,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err: any) {
    console.error('[checkout-api] Error:', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Error al iniciar checkout.' }, { status: 500 })
  }
}
