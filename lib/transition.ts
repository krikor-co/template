import { cookies } from 'next/headers'

/**
 * Creates a transition guard — a short-lived cookie that tells layout guards
 * "don't redirect yet, an exit animation is playing."
 *
 * Use this when a server action changes state that would cause a layout guard
 * to redirect (e.g., setting a session cookie while still on /auth/verify),
 * but the section needs time to show a success animation before navigating.
 *
 * Usage:
 *   const verify = createTransitionGuard('auth_verify', 2000)
 *
 *   // In the server action — grant the grace period:
 *   await verify.grant()
 *
 *   // In the layout guard — check before redirecting:
 *   if (await verify.isActive()) return null
 */
export function createTransitionGuard(name: string, durationMs: number) {
  const cookieName = `${name}_in_transition`

  return {
    cookieName,
    durationMs,

    async grant() {
      const cookieStore = await cookies()
      cookieStore.set(cookieName, '1', {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge:   Math.ceil(durationMs / 1000),
        path:     '/',
      })
    },

    async isActive() {
      const cookieStore = await cookies()
      return cookieStore.get(cookieName)?.value === '1'
    },
  }
}
