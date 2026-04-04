'use client'

import { scene } from './scene'
import type { State } from './state'

export function RecentAddedPeople({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)

  switch (state.status) {
    case 'idle':
      return <div>TODO: idle</div>
    case 'error':
      return (
        <div>
          <p>{state.message}</p>
          <button onClick={() => send({ type: 'RETRY' })}>Retry</button>
        </div>
      )
  }
}
