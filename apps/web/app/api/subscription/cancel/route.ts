import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import { cancelStripeSubscription } from '@music-flow/stripe'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autorizado. Debes iniciar sesión.' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Sesión no válida o expirada.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const immediate = Boolean(body?.immediate)
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : null

    // 1. Buscar suscripción individual
    let { data: sub } = await supabase
      .from('subscriptions')
      .select('id, owner_user_id, organization_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end')
      .eq('owner_user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si no tiene individual, verificar si es dueño de organización con suscripción
    if (!sub) {
      const { data: userOrgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_user_id', user.id)

      const orgIds = (userOrgs ?? []).map((o) => o.id)
      if (orgIds.length > 0) {
        const { data: orgSub } = await supabase
          .from('subscriptions')
          .select('id, owner_user_id, organization_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end')
          .in('organization_id', orgIds)
          .in('status', ['active', 'trialing', 'past_due'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (orgSub) {
          sub = orgSub
        }
      }
    }

    if (!sub) {
      return NextResponse.json(
        { ok: false, error: 'No tienes una suscripción activa para cancelar.' },
        { status: 404 }
      )
    }

    const isStripe =
      Boolean(sub.stripe_subscription_id) &&
      !sub.stripe_subscription_id!.startsWith('courtesy-') &&
      !sub.stripe_subscription_id!.startsWith('MS-')

    let newStatus = sub.status
    let newCancelAtPeriodEnd = !immediate

    // 2. Si es una suscripción real en Stripe, ejecutar la cancelación en Stripe
    if (isStripe && sub.stripe_subscription_id) {
      try {
        const stripeSub = await cancelStripeSubscription({
          stripeSubscriptionId: sub.stripe_subscription_id,
          immediate,
        })
        if (immediate || stripeSub.status === 'canceled') {
          newStatus = 'canceled'
          newCancelAtPeriodEnd = false
        } else {
          newCancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end)
        }
      } catch (stripeErr: any) {
        console.error('[subscription-cancel] Error comunicando con Stripe:', stripeErr.message)
        // Si la suscripción ya no existe en Stripe, sincronizamos a cancelada localmente
        if (stripeErr.code === 'resource_missing') {
          newStatus = 'canceled'
          newCancelAtPeriodEnd = false
        } else {
          throw new Error(stripeErr.message || 'Error cancelando suscripción en Stripe.')
        }
      }
    } else {
      // Suscripción de cortesía o manual
      if (immediate) {
        newStatus = 'canceled'
        newCancelAtPeriodEnd = false
      } else {
        newCancelAtPeriodEnd = true
      }
    }

    // 3. Actualizar registro en base de datos
    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({
        status: newStatus as any,
        cancel_at_period_end: newCancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id)

    if (updateErr) {
      throw new Error(`Error actualizando base de datos: ${updateErr.message}`)
    }

    // 4. Notificar a los administradores
    await supabase.from('admin_notifications').insert({
      type: immediate ? 'cancellation' : 'cancellation_scheduled',
      payload: {
        user_id: user.id,
        user_email: user.email,
        subscription_id: sub.id,
        stripe_subscription_id: sub.stripe_subscription_id,
        immediate,
        reason: reason || 'No especificado por el usuario',
        canceled_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      ok: true,
      message: immediate
        ? 'Tu suscripción ha sido cancelada inmediatamente.'
        : 'Cancelación programada: tu acceso se mantendrá hasta el fin del ciclo de facturación actual.',
      cancelAtPeriodEnd: newCancelAtPeriodEnd,
      status: newStatus,
      currentPeriodEnd: sub.current_period_end,
    })
  } catch (err: any) {
    console.error('[subscription-cancel] Error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al procesar la cancelación.' },
      { status: 500 }
    )
  }
}
