import type { BrowserContext } from '@playwright/test'

export async function setAuthEmailCookie(
  context: BrowserContext,
  email: string,
  isNew = false
) {
  const base = { domain: 'localhost', path: '/' }
  await context.addCookies([
    { name: 'auth_email', value: email, ...base },
    ...(isNew ? [{ name: 'auth_is_new', value: '1', ...base }] : []),
  ])
}

export async function setSessionCookie(context: BrowserContext, token: string) {
  await context.addCookies([
    { name: 'session_token', value: token, domain: 'localhost', path: '/', httpOnly: true },
  ])
}
