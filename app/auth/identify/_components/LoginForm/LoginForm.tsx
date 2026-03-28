'use client'

import { scene } from './scene'
import { sendLoginOtp } from './actions'
import type { State } from './state'

export function LoginForm({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)

  const handleSubmit = async (formData: FormData) => {
    send({ type: 'SUBMIT' })
    const result = await sendLoginOtp(formData)
    if (result && !result.success) send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="returnTo" value={state.returnTo ?? ''} />

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={state.email}
              onChange={(e) => send({ type: 'CHANGE_EMAIL', email: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
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
            {state.status === 'submitting' ? 'Sending code…' : 'Send login code'}
          </button>
        </form>
      )
  }
}
