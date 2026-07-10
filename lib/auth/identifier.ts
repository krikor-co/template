import { z } from 'zod'

export type IdentifierType = 'phone' | 'email'

const phoneRegex = /^\+?\d[\d\s()-]{7,}$/

export function detectIdentifierType(value: string): IdentifierType | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // If it looks like an email (has @), validate as email
  if (trimmed.includes('@')) {
    return z.string().email().safeParse(trimmed).success ? 'email' : null
  }

  // Otherwise try phone
  return phoneRegex.test(trimmed) ? 'phone' : null
}

/** Normalize phone to E.164-ish digits-only format with + prefix */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `+${digits}`
}

/**
 * Auth-flow cookie names — the single source of truth. Guards, actions, and
 * the logout path import these; never write the raw strings.
 */
export const AUTH_IDENTIFIER_COOKIE = 'auth_identifier'
export const AUTH_IDENTIFIER_TYPE_COOKIE = 'auth_identifier_type'
export const AUTH_IS_NEW_COOKIE = 'auth_is_new'

/** Session cookie (long-lived JWT). Set at verify, cleared at logout. */
export const AUTH_SESSION_COOKIE = 'session_token'
