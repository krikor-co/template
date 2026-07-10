'use client'

import { scene } from './scene'
import { sendLoginOtp } from './actions'
import type { State } from './state'
import { route } from '../../contract'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useFormValues } from '@/lib/hooks/useFormValues'
import { useT } from '@/lib/i18n/LocaleProvider'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'

export function LoginForm({ initialState, returnTo }: { initialState: State; returnTo?: string }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  const t = useT()
  useRedirectOnSuccess(state, [reset, form.reset])

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await sendLoginOtp(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: result.isNew ? route.exits.register() : route.exits.verify() })
    else send({ type: 'ERROR', message: result.error })
  }

  const header = (
    <div key="header" className="text-center">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{t.auth.identify.title}</h1>
      <p className="text-muted-foreground">{t.auth.identify.subtitle}</p>
    </div>
  )

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div key="login" className="space-y-8">
          {header}
          <form key="form" action={handleSubmit} className="space-y-4">
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
            <div className="space-y-2">
              <Label htmlFor="identifier">{t.auth.identify.identifierLabel}</Label>
              <Input
                key="identifier"
                id="identifier"
                name="identifier"
                type="text"
                inputMode="email"
                autoComplete="email tel"
                aria-describedby="identifier-help"
                required
                defaultValue={form.values.identifier}
                onChange={() => {
                  if (state.status === 'error') send({ type: 'RETRY' })
                }}
                placeholder={t.auth.identify.identifierPlaceholder}
              />
              <p id="identifier-help" className="text-xs text-muted-foreground">
                {t.auth.identify.identifierHelp}
              </p>
            </div>

            {state.status === 'error' && (
              <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
            )}

            <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
              {state.status === 'submitting' ? t.auth.identify.submitting : t.auth.identify.submit}
            </Button>
          </form>
        </div>
      )
    case 'success':
      return (
        <div key="login" className="space-y-8">
          {header}
          <form key="form" className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="identifier">{t.auth.identify.identifierLabel}</Label>
              <Input key="identifier" id="identifier" name="identifier" type="text" disabled defaultValue={form.values.identifier} placeholder={t.auth.identify.identifierPlaceholder} />
            </div>

            <p className="text-sm text-muted-foreground">{t.common.redirecting}</p>

            <Button key="submit" type="button" disabled>
              {t.common.redirecting}
            </Button>
          </form>
        </div>
      )
  }
}
