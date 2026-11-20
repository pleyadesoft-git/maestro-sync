import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import { reactivateStripeSubscription } from '@music-flow/stripe'

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

    // 1. Buscar suscripción individual con cancelación programada
    let { data: sub } = await supabase
      .from('subscriptions')
      .select('id, owner_user_id, organization_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end')
      .eq('owner_user_id', user.id)
      .eq('cancel_at_period_end', true)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si no tiene individual, verificar organización
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
          .eq('cancel_at_period_end', true)
          .in('status', ['active', 'trialing'])
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
        { ok: false, error: 'No se encontró una suscripción con cancelación programada para reactivar.' },
        { status: 404 }
      )
    }

    const isStripe =
      Boolean(sub.stripe_subscription_id) &&
      !sub.stripe_subscription_id!.startsWith('courtesy-') &&
      !sub.stripe_subscription_id!.startsWith('MS-')

    if (isStripe && sub.stripe_subscription_id) {
      try {
        await reactivateStripeSubscription({
          stripeSubscriptionId: sub.stripe_subscription_id,
        })
      } catch (stripeErr: any) {
        console.error('[subscription-reactivate] Error comunicando con Stripe:', stripeErr.message)
        throw new Error(stripeErr.message || 'Error reactivando suscripción en Stripe.')
      }
    }

    // 2. Actualizar registro en DB
    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id)

    if (updateErr) {
      throw new Error(`Error actualizando base de datos: ${updateErr.message}`)
    }

    // 3. Notificar a administradores
    await supabase.from('admin_notifications').insert({
      type: 'subscription_reactivated',
      payload: {
        user_id: user.id,
        user_email: user.email,
        subscription_id: sub.id,
        stripe_subscription_id: sub.stripe_subscription_id,
        reactivated_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Tu suscripción ha sido reactivada con éxito. Continuará renovándose normalmente.',
      cancelAtPeriodEnd: false,
    })
  } catch (err: any) {
    console.error('[subscription-reactivate] Error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al reactivar la suscripción.' },
      { status: 500 }
    )
  }
}
