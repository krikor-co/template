'use client'

import { useReducedMotion } from 'framer-motion'

/**
 * Reads the user's reduced-motion preference for the auth-success scene.
 * Extracted from `VerifySuccess` so no React hooks live in the component body.
 */
export function useVerifySuccess() {
  const reduce = useReducedMotion()
  return { reduce }
}
