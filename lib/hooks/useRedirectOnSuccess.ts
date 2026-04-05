'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useRedirectOnSuccess(
  state: { status: string; redirectTo?: string },
  reset: (() => void) | (() => void)[],
  delay = 1000
): void {
  const router = useRouter()
  const resets = Array.isArray(reset) ? reset : [reset]

  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      const timer = setTimeout(() => {
        router.push(state.redirectTo!)
        resets.forEach((fn) => fn())
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [state, router, delay, ...resets]) // eslint-disable-line react-hooks/exhaustive-deps
}
