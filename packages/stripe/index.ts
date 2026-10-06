import Stripe from 'stripe'

export function getStripeServerInstance() {
  const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
  return new Stripe(secretKey, {
    apiVersion: '2026-09-30.endive' as any,
    typescript: true,
  })
}

export const PLANS_CONFIG = {
  FREE: {
    code: 'free',
    name: 'Plan Gratuito',
    maxScores: 2,
  },
  INDIVIDUAL_MONTHLY: {
    code: 'individual_monthly',
    name: 'Plan Individual Mensual',
    maxScores: Infinity,
  },
  ORG_ANNUAL: {
    code: 'org_annual',
    name: 'Plan Orquesta / Organización',
    maxScores: Infinity,
  },
} as const
