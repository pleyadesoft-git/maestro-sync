import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Sesión inválida o expirada' }, { status: 401 })
    }

    // 1. Obtener perfil para evaluar estado de prueba gratuita inicial
    const { data: profile } = await supabase
      .from('profiles')
      .select('trial_ends_at')
      .eq('id', user.id)
      .maybeSingle()

    const now = new Date()
    const trialEndsAtDate = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null
    const isTrialActive = Boolean(trialEndsAtDate && trialEndsAtDate.getTime() > now.getTime())
    const trialDaysLeft =
      trialEndsAtDate && isTrialActive
        ? Math.max(0, Math.ceil((trialEndsAtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0

    // 2. Buscar suscripción individual
    let { data: sub } = await supabase
      .from('subscriptions')
      .select(`
        id,
        status,
        current_period_end,
        cancel_at_period_end,
        stripe_customer_id,
        stripe_subscription_id,
        seat_quantity,
        plan_id,
        organization_id,
        plans (
          code,
          name,
          price_cents,
          billing_interval,
          ensemble_type
        )
      `)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si no tiene individual, verificar si es dueño de una organización con suscripción
    if (!sub) {
      const { data: userOrgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_user_id', user.id)

      const orgIds = (userOrgs ?? []).map((o) => o.id)
      if (orgIds.length > 0) {
        const { data: orgSub } = await supabase
          .from('subscriptions')
          .select(`
            id,
            status,
            current_period_end,
            cancel_at_period_end,
            stripe_customer_id,
            stripe_subscription_id,
            seat_quantity,
            plan_id,
            organization_id,
            plans (
              code,
              name,
              price_cents,
              billing_interval,
              ensemble_type
            )
          `)
          .in('organization_id', orgIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (orgSub) {
          sub = orgSub
        }
      }
    }

    if (!sub) {
      return NextResponse.json({
        ok: true,
        hasSubscription: false,
        isTrialActive,
        trialDaysLeft,
        trialEndsAt: profile?.trial_ends_at ?? null,
        subscription: null,
      })
    }

    const planInfo = (sub as any).plans
    const isCourtesy =
      !sub.stripe_subscription_id ||
      sub.stripe_subscription_id.startsWith('courtesy-') ||
      sub.stripe_subscription_id.startsWith('MS-')

    const isActive =
      sub.status === 'active' ||
      sub.status === 'trialing' ||
      (sub.current_period_end && new Date(sub.current_period_end).getTime() > now.getTime())

    return NextResponse.json({
      ok: true,
      hasSubscription: true,
      isTrialActive,
      trialDaysLeft,
      trialEndsAt: profile?.trial_ends_at ?? null,
      isCourtesy,
      subscription: {
        id: sub.id,
        status: sub.status,
        isActive: Boolean(isActive),
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        currentPeriodEnd: sub.current_period_end,
        stripeCustomerId: sub.stripe_customer_id,
        stripeSubscriptionId: sub.stripe_subscription_id,
        seatQuantity: sub.seat_quantity,
        planCode: planInfo?.code ?? 'unknown',
        planName: planInfo?.name ?? 'Plan Personal',
        priceCents: planInfo?.price_cents ?? 0,
        billingInterval: planInfo?.billing_interval ?? 'month',
        ensembleType: planInfo?.ensemble_type ?? null,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error obteniendo estado de suscripción' },
      { status: 500 }
    )
  }
}
