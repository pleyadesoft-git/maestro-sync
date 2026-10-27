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
    name: 'Prueba Gratuita (15 días)',
    priceCents: 0,
    seatPriceCents: 0,
    interval: null,
    ensembleType: null,
    maxMembers: null,
    trialDays: 15,
  },
  INDIVIDUAL_MONTHLY: {
    code: 'individual_monthly',
    name: 'Músico Independiente (Mensual)',
    priceCents: 800,
    seatPriceCents: 0,
    interval: 'month',
    ensembleType: null,
    maxMembers: null,
    trialDays: null,
  },
  INDIVIDUAL_ANNUAL: {
    code: 'individual_annual',
    name: 'Músico Independiente (Anual -15%)',
    priceCents: 8160,
    seatPriceCents: 0,
    interval: 'year',
    ensembleType: null,
    maxMembers: null,
    trialDays: null,
  },
  BAND_MONTHLY: {
    code: 'band_monthly',
    name: 'Banda (Mensual)',
    priceCents: 2200,
    seatPriceCents: 300,
    interval: 'month',
    ensembleType: 'band',
    maxMembers: 15,
    trialDays: null,
  },
  BAND_ANNUAL: {
    code: 'band_annual',
    name: 'Banda (Anual -15%)',
    priceCents: 22440,
    seatPriceCents: 3060,
    interval: 'year',
    ensembleType: 'band',
    maxMembers: 15,
    trialDays: null,
  },
  ORCHESTRA_MONTHLY: {
    code: 'orchestra_monthly',
    name: 'Orquesta Sinfónica/Filarmónica (Mensual)',
    priceCents: 4500,
    seatPriceCents: 300,
    interval: 'month',
    ensembleType: 'orchestra',
    maxMembers: null,
    trialDays: null,
  },
  ORCHESTRA_ANNUAL: {
    code: 'orchestra_annual',
    name: 'Orquesta Sinfónica/Filarmónica (Anual -15%)',
    priceCents: 45900,
    seatPriceCents: 3060,
    interval: 'year',
    ensembleType: 'orchestra',
    maxMembers: null,
    trialDays: null,
  },
} as const
