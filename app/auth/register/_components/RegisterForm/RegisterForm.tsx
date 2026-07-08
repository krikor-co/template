'use client'

import { scene } from './scene'
import { registerAction } from './actions'
import type { State } from './state'
import { route } from '../../contract'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useFormValues } from '@/lib/hooks/useFormValues'
import { useT } from '@/lib/i18n/LocaleProvider'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'

export function RegisterForm({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  const m = useT()
  useRedirectOnSuccess(state, [reset, form.reset])

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await registerAction(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: route.exits.verify() })
    else send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div key="register" className="space-y-8">
          <div key="header" className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.register.title}</h1>
            <p className="text-muted-foreground">{m.auth.register.subtitle}</p>
          </div>
          <form key="form" action={handleSubmit} className="space-y-4">
            <input type="hidden" name="email" value={state.email} />

            <div className="space-y-2">
              <Label>{m.auth.register.emailLabel}</Label>
              <p key="email-display" className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {state.email}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {m.auth.register.nameLabel} <span className="text-muted-foreground">{m.common.optional}</span>
              </Label>
              <Input
                key="name"
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                defaultValue={form.values.name}
                onChange={() => {
                  if (state.status === 'error') send({ type: 'RETRY' })
                }}
                placeholder={m.auth.register.namePlaceholder}
              />
            </div>

            {state.status === 'error' && (
              <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
            )}

            <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
              {state.status === 'submitting' ? m.auth.register.submitting : m.auth.register.submit}
            </Button>
          </form>
        </div>
      )
    case 'success':
      return (
        <div key="register" className="space-y-8">
          <div key="header" className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.register.title}</h1>
            <p className="text-muted-foreground">{m.auth.register.subtitle}</p>
          </div>
          <form key="form" className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label>{m.auth.register.emailLabel}</Label>
              <p key="email-display" className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {state.email}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {m.auth.register.nameLabel} <span className="text-muted-foreground">{m.common.optional}</span>
              </Label>
              <Input key="name" id="name" name="name" type="text" disabled defaultValue={form.values.name} placeholder={m.auth.register.namePlaceholder} />
            </div>

            <p className="text-sm text-muted-foreground">{m.auth.register.success}</p>

            <Button key="submit" type="button" disabled>
              {m.common.redirecting}
            </Button>
          </form>
        </div>
      )
  }
}
