'use client'

import { scene } from './scene'
import { verifyOtpAction } from './actions'
import { useResendOtp } from './useResendOtp'
import type { State } from './state'
import { route } from '../../contract'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useFormValues } from '@/lib/hooks/useFormValues'
import { useT } from '@/lib/i18n/LocaleProvider'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'

export function VerifyForm({ initialState, returnTo }: { initialState: State; returnTo?: string }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  const m = useT()
  const resendOtp = useResendOtp(initialState.email)
  useRedirectOnSuccess(state, [reset, form.reset], 2000)

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
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.verify.titleEmail}</h1>
            <p className="text-muted-foreground">
              {m.auth.verify.sentTo} <strong>{state.email}</strong>
            </p>
          </div>
          <form key="form" action={handleSubmit} className="space-y-4">
            <input type="hidden" name="email" value={state.email} />

            <div className="space-y-2">
              <Label htmlFor="code">{m.auth.verify.codeLabel}</Label>
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
              {state.status === 'submitting' ? m.auth.verify.submitting : m.auth.verify.submit}
            </Button>
          </form>

          <div key="resend" className="text-center text-sm">
            {resendOtp.status === 'waiting' && (
              <p className="text-muted-foreground">{m.auth.verify.resendIn(resendOtp.secondsLeft)}</p>
            )}
            {resendOtp.status === 'ready' && (
              <button type="button" onClick={resendOtp.resend} className="text-primary underline-offset-4 hover:underline">
                {m.auth.verify.resend}
              </button>
            )}
            {resendOtp.status === 'sending' && (
              <p className="text-muted-foreground">{m.auth.verify.sending}</p>
            )}
            {resendOtp.status === 'sent' && (
              <p className="text-muted-foreground">{m.auth.verify.sent}</p>
            )}
            {resendOtp.status === 'error' && (
              <div className="space-y-1">
                <p className="text-destructive">{resendOtp.error}</p>
                <button type="button" onClick={resendOtp.resend} className="text-primary underline-offset-4 hover:underline">
                  {m.common.tryAgain}
                </button>
              </div>
            )}
          </div>
        </div>
      )
    case 'success':
      return (
        <div key="verify" className="space-y-8">
          <div key="header" className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.verify.titleEmail}</h1>
            <p className="text-muted-foreground">
              {m.auth.verify.sentTo} <strong>{state.email}</strong>
            </p>
          </div>
          <form key="form" className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="code">{m.auth.verify.codeLabel}</Label>
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

            <p className="text-sm text-muted-foreground">{m.auth.verify.successHint}</p>

            <Button key="submit" type="button" disabled>
              {m.common.redirecting}
            </Button>
          </form>
        </div>
      )
  }
}
