'use client'

import { scene } from './scene'
import { registerAction } from './actions'
import type { State } from './state'

export function RegisterForm({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)

  const handleSubmit = async (formData: FormData) => {
    send({ type: 'SUBMIT' })
    const result = await registerAction(formData)
    if (result && !result.success) send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="email"    value={state.email} />
          <input type="hidden" name="returnTo" value={state.returnTo ?? ''} />

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {state.email}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={state.name}
              onChange={(e) => send({ type: 'CHANGE_NAME', name: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Your name"
            />
          </div>

          {state.status === 'error' && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={state.status === 'submitting'}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {state.status === 'submitting' ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )
  }
}
