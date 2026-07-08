import { useState } from 'react'
import { route } from '../../contract'
import { scene } from './scene'
import { acceptInvite } from './actions'

type Args = {
  token:        string
  existingName: string | null
}

/**
 * Accept-invite form logic. Holds the name input (pre-filled from any name
 * already on file so the invitee validates/corrects it) and orchestrates the
 * magic-link accept: one click provisions identity + a session and lands the
 * invitee in the workspace.
 */
export function useAcceptForm({ token, existingName }: Args) {
  const [state, send] = scene.useScene({ status: 'idle' } as const)
  const [name, setName] = useState(() => existingName ?? '')

  const accept = async () => {
    if (state.status === 'submitting') return
    send({ type: 'SUBMIT' })
    const result = await acceptInvite({ token, name: name.trim() || undefined })
    if (result.success) {
      // Accept LOGS THE INVITEE IN (new session cookie). A soft router.push
      // wouldn't reliably pick up the fresh session, so hard-navigate — this
      // guarantees they land in their workspace authenticated. Stays in
      // 'submitting' (button shows "Accepting…") until the page unloads.
      window.location.assign(route.exits.workspace({ workspaceId: result.workspaceId }))
      return
    }
    send({ type: 'ERROR', message: result.error })
  }

  return { state, accept, name, setName }
}
