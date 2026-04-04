'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useRedirectOnSuccess(
  state: { status: string; redirectTo?: string },
  reset: () => void,
  delay = 1000
): void {
  const router = useRouter()

  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      const timer = setTimeout(() => {
        router.push(state.redirectTo!)
        reset()
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [state, router, delay, reset])
}
