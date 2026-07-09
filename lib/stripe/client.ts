import 'server-only'
import Stripe from 'stripe'

/**
 * Server-side Stripe singleton (test/sandbox keys for now). `null` when the
 * secret key isn't configured so the app degrades gracefully in environments
 * without billing set up. Use {@link getStripe} where a configured client is
 * required (it throws a clear error instead of a null deref).
 */
const secret = process.env.STRIPE_SECRET_KEY

export const stripe: Stripe | null = secret ? new Stripe(secret) : null

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).')
  }
  return stripe
}

export function isStripeConfigured(): boolean {
  return stripe !== null
}
