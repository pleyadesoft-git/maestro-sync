import { NextResponse } from 'next/server'
import { getStripeServerInstance } from '@music-flow/stripe'
import { createServiceRoleClient } from '@music-flow/supabase'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') || ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

  try {
    const stripe = getStripeServerInstance()
    let event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        // Handle successful subscription checkout
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        // Sync subscription status with Supabase `subscriptions` table
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
