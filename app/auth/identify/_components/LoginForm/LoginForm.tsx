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
  const m = useT()
  useRedirectOnSuccess(state, [reset, form.reset])

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await sendLoginOtp(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: result.isNew ? route.exits.register() : route.exits.verify() })
    else send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div key="login" className="space-y-8">
          <div key="header" className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.identify.title}</h1>
            <p className="text-muted-foreground">{m.auth.identify.subtitle}</p>
          </div>
          <form key="form" action={handleSubmit} className="space-y-4">
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
            <div className="space-y-2">
              <Label htmlFor="email">{m.auth.identify.identifierLabel}</Label>
              <Input
                key="email"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={form.values.email}
                onChange={() => {
                  if (state.status === 'error') send({ type: 'RETRY' })
                }}
                placeholder={m.auth.identify.identifierPlaceholder}
              />
            </div>

            {state.status === 'error' && (
              <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
            )}

            <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
              {state.status === 'submitting' ? m.auth.identify.submitting : m.auth.identify.submit}
            </Button>
          </form>
        </div>
      )
    case 'success':
      return (
        <div key="login" className="space-y-8">
          <div key="header" className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.identify.title}</h1>
            <p className="text-muted-foreground">{m.auth.identify.subtitle}</p>
          </div>
          <form key="form" className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="email">{m.auth.identify.identifierLabel}</Label>
              <Input key="email" id="email" name="email" type="email" disabled defaultValue={form.values.email} placeholder={m.auth.identify.identifierPlaceholder} />
            </div>

            <p className="text-sm text-muted-foreground">{m.common.redirecting}</p>

            <Button key="submit" type="button" disabled>
              {m.common.redirecting}
            </Button>
          </form>
        </div>
      )
  }
}
