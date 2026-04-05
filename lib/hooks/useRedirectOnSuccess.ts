'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'

export function useRedirectOnSuccess(
  state: { status: string; redirectTo?: string },
  reset: (() => void) | (() => void)[],
  delay = 1000
): void {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const resets = Array.isArray(reset) ? reset : [reset]

  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      const timer = setTimeout(() => {
        startTransition(() => {
          resets.forEach((fn) => fn())
          router.push(state.redirectTo!)
        })
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [state, router, delay, startTransition, ...resets]) // eslint-disable-line react-hooks/exhaustive-deps
}
