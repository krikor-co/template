'use client'

import { scene } from './scene'
import { verifyOtpAction } from './actions'
import { useResendOtp } from './useResendOtp'
import type { State } from './state'
import { route } from '../../contract'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useFormValues } from '@/lib/hooks/useFormValues'
import { useT } from '@/lib/i18n/LocaleProvider'
import { OtpInput } from '@/components/ui/OtpInput'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { VerifySuccess } from './VerifySuccess'

export function VerifyForm({ initialState, returnTo }: { initialState: State; returnTo?: string }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  const t = useT()
  const resendOtp = useResendOtp(initialState.identifier, initialState.identifierType)
  useRedirectOnSuccess(state, [reset, form.reset], 2000)

  const title = state.identifierType === 'email' ? t.auth.verify.titleEmail : t.auth.verify.titlePhone

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await verifyOtpAction(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: returnTo ?? route.exits.dashboard() })
    else send({ type: 'ERROR', message: result.error })
  }

  const header = (
    <div key="header" className="text-center">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        {t.auth.verify.sentTo} <strong className="tabular-nums">{state.identifier}</strong>
      </p>
    </div>
  )

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div key="verify" className="space-y-8">
          {header}
          <form key="form" action={handleSubmit} className="space-y-4">
            <input type="hidden" name="identifier" value={state.identifier} />
            <input type="hidden" name="identifierType" value={state.identifierType} />

            <div className="space-y-2">
              <Label htmlFor="code">{t.auth.verify.codeLabel}</Label>
              {/* Segmented input-otp field: one real hidden <input name="code">
                  drives six styled slots — numeric-only, OS one-time-code
                  autofill, paste fills every box. The form contract (and
                  e2e page.fill('input[name="code"]')) is unchanged. */}
              <OtpInput
                id="code"
                name="code"
                autoFocus
                defaultValue={form.values.code}
                hasError={state.status === 'error'}
                onChange={() => {
                  if (state.status === 'error') send({ type: 'RETRY' })
                }}
              />
            </div>

            {state.status === 'error' && (
              <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
            )}

            <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
              {state.status === 'submitting' ? t.auth.verify.submitting : t.auth.verify.submit}
            </Button>
          </form>

          <div key="resend" className="text-center text-sm">
            {resendOtp.status === 'waiting' && (
              <p className="text-muted-foreground">{t.auth.verify.resendIn(resendOtp.secondsLeft)}</p>
            )}
            {resendOtp.status === 'ready' && (
              <button type="button" onClick={resendOtp.resend} className="text-primary underline-offset-4 hover:underline">
                {t.auth.verify.resend}
              </button>
            )}
            {resendOtp.status === 'sending' && (
              <p className="text-muted-foreground">{t.auth.verify.sending}</p>
            )}
            {resendOtp.status === 'sent' && (
              <p className="text-muted-foreground">{t.auth.verify.sent}</p>
            )}
            {resendOtp.status === 'error' && (
              <div className="space-y-1">
                <p className="text-destructive">{resendOtp.error}</p>
                <button type="button" onClick={resendOtp.resend} className="text-primary underline-offset-4 hover:underline">
                  {t.common.tryAgain}
                </button>
              </div>
            )}
          </div>
        </div>
      )
    case 'success':
      return (
        <div key="verify" className="space-y-8">
          {header}
          <VerifySuccess title={t.auth.verify.successTitle} hint={t.auth.verify.successHint} />
        </div>
      )
  }
}
