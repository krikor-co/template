'use client'

import { route } from '../../contract'
import { scene } from './scene'
import { logoutAction } from './actions'
import type { State } from './state'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'

export function LogoutButton({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  useRedirectOnSuccess(state, reset)

  const handleClick = async () => {
    send({ type: 'SUBMIT' })
    const result = await logoutAction()
    if (result.success) send({ type: 'SUCCESS', redirectTo: route.exits.login() })
    else                send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'error':
      return (
        <div>
          <button
            onClick={handleClick}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Log out
          </button>
          {state.status === 'error' && (
            <p className="mt-1 text-sm text-destructive">{state.message}</p>
          )}
        </div>
      )
    case 'submitting':
      return (
        <button
          disabled
          className="rounded-md border px-4 py-2 text-sm font-medium opacity-50"
        >
          Logging out…
        </button>
      )
    case 'success':
      return (
        <button
          disabled
          className="rounded-md border px-4 py-2 text-sm font-medium opacity-50"
        >
          Logged out
        </button>
      )
  }
}
