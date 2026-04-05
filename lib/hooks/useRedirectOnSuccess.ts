'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function useRedirectOnSuccess(
  state: { status: string; redirectTo?: string },
  reset: (() => void) | (() => void)[],
  delay = 1000
): void {
  const router = useRouter()
  const pathname = usePathname()
  const resets = Array.isArray(reset) ? reset : [reset]
  const navigatingRef = useRef(false)

  // Step 1: After delay, push the route
  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      const timer = setTimeout(() => {
        navigatingRef.current = true
        router.push(state.redirectTo!)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [state, router, delay])

  // Step 2: Reset only after the pathname has actually changed
  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false
      resets.forEach((fn) => fn())
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
}
