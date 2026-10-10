import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeServerInstance } from '@music-flow/stripe'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import type { Database } from '@music-flow/supabase'

type SubscriptionStatus =
  Database['public']['Tables']['subscriptions']['Row']['status']

// Stripe expone estados que no existen en el modelo local: se normalizan aquí.
function normalizeSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'incomplete':
    case 'canceled':
      return status
    case 'unpaid':
      return 'past_due'
    case 'incomplete_expired':
    case 'paused':
      return 'canceled'
    default:
      return 'canceled'
  }
}

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string | null {
  if (typeof customer === 'string') return customer
  return customer?.id ?? null
}

async function syncSubscription(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription,
  context: { userId?: string | null; organizationId?: string | null } = {}
) {
  const item = subscription.items?.data?.[0]
  const priceId: string | undefined = item?.price?.id
  const metadata = subscription.metadata ?? {}
  const organizationId = context.organizationId ?? metadata.organization_id ?? null
  const ownerUserId = organizationId
    ? null
    : context.userId ?? metadata.user_id ?? null

  // 1) Resolver el plan local a partir del Price de Stripe
  let planId: string | null = null
  if (priceId) {
    const { data: byPrice } = await supabase
      .from('plans')
      .select('id')
      .eq('stripe_price_id', priceId)
      .maybeSingle()
    planId = byPrice?.id ?? null
  }
  if (!planId && metadata.plan_code) {
    const { data: byCode } = await supabase
      .from('plans')
      .select('id')
      .eq('code', metadata.plan_code)
      .maybeSingle()
    planId = byCode?.id ?? null
  }

  if (!planId) {
    console.warn(
      `[stripe-webhook] No se encontró plan para price=${priceId ?? 'n/a'} / plan_code=${metadata.plan_code ?? 'n/a'}`
    )
    return false
  }

  if (!ownerUserId && !organizationId) {
    console.warn(
      `[stripe-webhook] Suscripción ${subscription.id} sin user_id/organization_id en metadata; no se persiste.`
    )
    return false
  }

  // 2) `current_period_end` vive en el item de suscripción en esta versión de la API
  const periodEndSeconds: number | undefined =
    (item as { current_period_end?: number } | undefined)?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end

  const row = {
    plan_id: planId,
    owner_user_id: ownerUserId,
    organization_id: organizationId,
    stripe_customer_id: customerIdOf(subscription.customer),
    stripe_subscription_id: subscription.id,
    status: normalizeSubscriptionStatus(subscription.status),
    current_period_end: periodEndSeconds
      ? new Date(periodEndSeconds * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' })

  if (error) {
    console.error(`[stripe-webhook] Error guardando suscripción ${subscription.id}:`, error.message)
    throw new Error(error.message)
  }

  return true
}

async function notifyAdmin(
  supabase: ReturnType<typeof createServiceRoleClient>,
  type: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from('admin_notifications').insert({
    type,
    payload: payload as Database['public']['Tables']['admin_notifications']['Insert']['payload'],
  })
  if (error) console.error(`[stripe-webhook] No se pudo crear la notificación (${type}):`, error.message)
}

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') || ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET no configurado' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripeServerInstance()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    const supabase = createServiceRoleClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const userId =
            session.client_reference_id ?? session.metadata?.user_id ?? null
          const persisted = await syncSubscription(supabase, subscription, {
            userId,
            organizationId: session.metadata?.organization_id ?? null,
          })
          if (persisted) {
            await notifyAdmin(supabase, 'new_subscription', {
              stripe_subscription_id: subscription.id,
              user_id: userId,
              status: subscription.status,
            })
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        await syncSubscription(supabase, subscription)
        if (event.type === 'customer.subscription.created') {
          await notifyAdmin(supabase, 'new_subscription', {
            stripe_subscription_id: subscription.id,
            status: subscription.status,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        await syncSubscription(supabase, subscription)
        await notifyAdmin(supabase, 'cancellation', {
          stripe_subscription_id: subscription.id,
        })
        break
      }

      default:
        // Eventos no manejados se acknowledge-ean para evitar reintentos infinitos
        break
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[stripe-webhook] Error procesando el evento:', error?.message)
    return NextResponse.json({ error: error?.message || 'webhook_error' }, { status: 500 })
  }
}
