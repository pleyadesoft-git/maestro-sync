import Stripe from 'stripe'

export function getStripeServerInstance() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      '[music-flow] Falta STRIPE_SECRET_KEY. Copia .env.example a .env y completa el valor.'
    )
  }
  return new Stripe(secretKey, {
    apiVersion: '2026-09-30.endive' as any,
    typescript: true,
  })
}

export const PLANS_CONFIG = {
  FREE: {
    code: 'free',
    name: 'Prueba Gratuita (7 días)',
    priceCents: 0,
    seatPriceCents: 0,
    interval: null,
    ensembleType: null,
    maxMembers: null,
    trialDays: 7,
  },
  SOLO_MONTHLY: {
    code: 'solo_monthly',
    name: 'Solo (Mensual)',
    priceCents: 500, // $5/mes (Precio de introducción)
    seatPriceCents: 0,
    interval: 'month',
    ensembleType: null,
    maxMembers: 1,
    trialDays: null,
  },
  SOLO_ANNUAL: {
    code: 'solo_annual',
    name: 'Solo (Anual -15%)',
    priceCents: 5100, // $51/año ($4.25/mes)
    seatPriceCents: 0,
    interval: 'year',
    ensembleType: null,
    maxMembers: 1,
    trialDays: null,
  },
  BAND_MONTHLY: {
    code: 'band_monthly',
    name: 'Band (Mensual - 2 a 20 músicos)',
    priceCents: 6500, // $65/mes (de 2 a 20 músicos, precio de introducción)
    seatPriceCents: 0,
    interval: 'month',
    ensembleType: 'band',
    maxMembers: 20,
    trialDays: null,
  },
  BAND_ANNUAL: {
    code: 'band_annual',
    name: 'Band (Anual -15%)',
    priceCents: 66300, // $663/año ($55.25/mes)
    seatPriceCents: 0,
    interval: 'year',
    ensembleType: 'band',
    maxMembers: 20,
    trialDays: null,
  },
  ORCHESTRA_MONTHLY: {
    code: 'orchestra_monthly',
    name: 'Orchestra (Mensual)',
    priceCents: 9500, // $95/mes (gran ensamble / ilimitado, precio de introducción)
    seatPriceCents: 0,
    interval: 'month',
    ensembleType: 'orchestra',
    maxMembers: null,
    trialDays: null,
  },
  ORCHESTRA_ANNUAL: {
    code: 'orchestra_annual',
    name: 'Orchestra (Anual -15%)',
    priceCents: 96900, // $969/año ($80.75/mes)
    seatPriceCents: 0,
    interval: 'year',
    ensembleType: 'orchestra',
    maxMembers: null,
    trialDays: null,
  },
  // Alias de retrocompatibilidad con registros existentes
  INDIVIDUAL_MONTHLY: {
    code: 'individual_monthly',
    name: 'Solo (Mensual)',
    priceCents: 500,
    seatPriceCents: 0,
    interval: 'month',
    ensembleType: null,
    maxMembers: 1,
    trialDays: null,
  },
  INDIVIDUAL_ANNUAL: {
    code: 'individual_annual',
    name: 'Solo (Anual -15%)',
    priceCents: 5100,
    seatPriceCents: 0,
    interval: 'year',
    ensembleType: null,
    maxMembers: 1,
    trialDays: null,
  },
} as const

export async function cancelStripeSubscription({
  stripeSubscriptionId,
  immediate = false,
}: {
  stripeSubscriptionId: string
  immediate?: boolean
}) {
  const stripe = getStripeServerInstance()
  if (immediate) {
    return await stripe.subscriptions.cancel(stripeSubscriptionId)
  }
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  })
}

export async function reactivateStripeSubscription({
  stripeSubscriptionId,
}: {
  stripeSubscriptionId: string
}) {
  const stripe = getStripeServerInstance()
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  })
}

export async function getStripeSubscription(stripeSubscriptionId: string) {
  const stripe = getStripeServerInstance()
  return await stripe.subscriptions.retrieve(stripeSubscriptionId)
}
