'use client'

import { useEffect } from 'react'
import type { State, Event } from './state'
import { checkActive } from './actions'

/**
 * Polls `checkActive(workspaceId)` every `intervalMs` while in `pending`. When
 * the workspace reads active, sends `ACTIVE` with the post-payment forward
 * target so the section transitions to `success` and `useRedirectOnSuccess`
 * forwards there. Stops as soon as we leave `pending`. Keeps all timer/effect
 * logic out of the component (Flow Framework: hooks live in `.ts` files).
 */
export function usePollActive(
  state: State,
  send: (event: Event) => void,
  args: { workspaceId: string; forwardHref: string; intervalMs?: number },
): void {
  const { workspaceId, forwardHref, intervalMs = 1500 } = args

  useEffect(() => {
    if (state.status !== 'pending') return
    let cancelled = false

    const tick = async () => {
      const result = await checkActive({ workspaceId })
      if (cancelled) return
      if (result.success && result.active) {
        send({ type: 'ACTIVE', redirectTo: forwardHref })
      }
    }

    // Probe immediately, then on an interval until active or unmounted.
    void tick()
    const id = setInterval(() => void tick(), intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [state.status, workspaceId, forwardHref, intervalMs, send])
}
