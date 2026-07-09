'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Subscribes to the workspace's SSE liveness stream and refreshes the current
 * route when a `pulse` arrives — which re-runs the server components' own
 * scoped queries, so the screen reflects another device's action (a record
 * settled, a row approved elsewhere) without a manual reload.
 *
 * EventSource reconnects automatically when the server closes the stream near
 * the function time limit or the network blips. Renders nothing. Mount it in
 * a workspace-scoped layout or page.
 */
export function WorkspaceLive({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return
    const es = new EventSource(`/api/workspace/${workspaceId}/stream`)
    const onPulse = () => router.refresh()
    es.addEventListener('pulse', onPulse)
    return () => {
      es.removeEventListener('pulse', onPulse)
      es.close()
    }
  }, [workspaceId, router])

  return null
}
