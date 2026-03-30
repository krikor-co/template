'use client'

import { useState } from 'react'
import { scene } from './scene'
import { sendLoginOtp } from './actions'
import type { State } from './state'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function LoginForm({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)
  const [email, setEmail] = useState('')
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    send({ type: 'SUBMIT' })
    const result = await sendLoginOtp(formData)
    if (result && result.success)  send({ type: 'SUCCESS', redirectTo: result.redirectTo })
    else if (result && result.error) send({ type: 'ERROR',   message:    result.error })
  }

  useEffect(() => {
    if (state.status === 'success') {
      setTimeout(() => router.push(state.redirectTo), 1000)
    }
  }, [state, router])

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">Enter your email to continue</p>
          </div>
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
                value={email}
                onChange={(e) => {
                  if (state.status === 'error') send({ type: 'RETRY' })
                  setEmail(e.target.value)
                }}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
              />
            </div>

            {state.status === 'error' && (
              <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
            )}

            <button
              type="submit"
              disabled={state.status === 'submitting'}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {state.status === 'submitting' ? 'Checking for account…' : 'Log in'}
            </button>
          </form>
        </div>
      )
    case 'success':
      return (
        <div className="space-y-4">
          <p className="text-sm text-green-500">Account found! Redirecting to verification…</p>
        </div>
      )
  }
}
