import type { BrowserContext } from '@playwright/test'

export async function setAuthIdentifierCookie(
  context: BrowserContext,
  identifier: string,
  identifierType: 'phone' | 'email' = 'email',
  isNew = false
) {
  const base = { domain: 'localhost', path: '/' }
  await context.addCookies([
    { name: 'auth_identifier', value: identifier, ...base },
    { name: 'auth_identifier_type', value: identifierType, ...base },
    ...(isNew ? [{ name: 'auth_is_new', value: '1', ...base }] : []),
  ])
}

export async function setReturnToCookie(context: BrowserContext, returnTo: string) {
  await context.addCookies([
    { name: 'auth_return_to', value: returnTo, domain: 'localhost', path: '/', httpOnly: true },
  ])
}

export async function setSessionCookie(context: BrowserContext, token: string) {
  await context.addCookies([
    { name: 'session_token', value: token, domain: 'localhost', path: '/', httpOnly: true },
  ])
}
