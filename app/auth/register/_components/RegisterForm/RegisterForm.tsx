'use client'

import { useState } from 'react'
import { scene } from './scene'
import { registerAction } from './actions'
import type { State } from './state'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function RegisterForm({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)
  const [name, setName] = useState('')
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    send({ type: 'SUBMIT' })
    const result = await registerAction(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: result.redirectTo })
    else if (result.error) send({ type: 'ERROR', message: result.error })
  }

  useEffect(() => {
    if (state.status === 'success') {
      setTimeout(() => {
        router.push(state.redirectTo);
      }, 1000);
    }
  }, [state, router])

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground">Just your name to get started</p>
          </div>
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
                value={name}
                onChange={(e) => {
                  if (state.status === 'error') send({ type: 'RETRY' })
                  setName(e.target.value)
                }}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name"
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
              {state.status === 'submitting' ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      )
    case 'success':
      return (
        <div className="space-y-4">
          <p className="text-sm text-green-500">Account created! Redirecting to verification…</p>
        </div>
      )
  }
}
