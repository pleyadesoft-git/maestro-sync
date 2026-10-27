import { NextRequest, NextResponse } from 'next/server'
import { getStripeServerInstance, PLANS_CONFIG } from '@music-flow/stripe'
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

    const body = await req.json()
    const { planCode, interval = 'month', ensembleName } = body

    const planKey = Object.keys(PLANS_CONFIG).find(
      (k) => (PLANS_CONFIG as any)[k].code === planCode
    )
    if (!planKey) {
      return NextResponse.json({ ok: false, error: 'Plan seleccionado inválido.' }, { status: 400 })
    }
    const planConfig = (PLANS_CONFIG as any)[planKey]

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

    // 2. Si es plan organizacional (Banda u Orquesta), crear o resolver la organización
    let organizationId: string | null = null
    if (planConfig.ensembleType) {
      const orgName = (ensembleName || '').trim() || (planConfig.ensembleType === 'band' ? 'Mi Banda' : 'Mi Orquesta')
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          owner_user_id: user.id,
          name: orgName,
          ensemble_type: planConfig.ensembleType,
          max_members: planConfig.maxMembers,
          invite_code: inviteCode,
        })
        .select('id')
        .single()

      if (orgErr || !org) {
        throw new Error(orgErr?.message || 'No se pudo crear el ensamble.')
      }
      organizationId = org.id

      // Registrar al creador como director
      await supabase.from('organization_members').insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'director',
      })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'

    // 3. Crear sesión de Stripe Checkout con precio dinámico
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
                ? `Plan ${planConfig.name} para dirección de ensamble musical`
                : 'Suscripción personal para músico solista',
            },
            unit_amount: planConfig.priceCents,
            recurring: {
              interval: interval === 'year' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_code: planCode,
          organization_id: organizationId,
        },
      },
      metadata: {
        user_id: user.id,
        plan_code: planCode,
        organization_id: organizationId,
      },
      success_url: `${origin}/es/library?success=subscription_created`,
      cancel_url: `${origin}/es/pricing?cancelled=true`,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err: any) {
    console.error('[checkout-api] Error:', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Error al iniciar checkout.' }, { status: 500 })
  }
}
