'use client'

import { scene } from './scene'
import { verifyOtpAction } from './actions'
import type { State } from './state'
import { route } from '../../contract'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useFormValues } from '@/lib/hooks/useFormValues'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'

export function VerifyForm({ initialState, returnTo }: { initialState: State; returnTo?: string }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  useRedirectOnSuccess(state, reset, 2000)

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await verifyOtpAction(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: returnTo ?? route.exits.dashboard() })
    else send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div key="verify" className="space-y-8">
          <div key="header" className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-muted-foreground">
              We sent a 6-digit code to <strong>{state.email}</strong>
            </p>
          </div>
          <form key="form" action={handleSubmit} className="space-y-4">
            <input type="hidden" name="email" value={state.email} />

            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                key="code"
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                defaultValue={form.values.code}
                onChange={() => {
                  if (state.status === 'error') send({ type: 'RETRY' })
                }}
                className="py-2.5 text-center text-2xl tracking-widest"
                placeholder="000000"
              />
            </div>

            {state.status === 'error' && (
              <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
            )}

            <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
              {state.status === 'submitting' ? 'Verifying…' : 'Verify code'}
            </Button>
          </form>
        </div>
      )
    case 'success':
      return (
        <div key="verify" className="space-y-8">
          <div key="header" className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-muted-foreground">
              We sent a 6-digit code to <strong>{state.email}</strong>
            </p>
          </div>
          <form key="form" className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                key="code"
                id="code"
                name="code"
                type="text"
                disabled
                defaultValue={form.values.code}
                className="py-2.5 text-center text-2xl tracking-widest"
                placeholder="000000"
              />
            </div>

            <p className="text-sm text-muted-foreground">Verified! Redirecting…</p>

            <Button key="submit" type="button" disabled>
              Redirecting…
            </Button>
          </form>
        </div>
      )
  }
}
