'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useT } from '@/lib/i18n/LocaleProvider'
import { useAcceptForm } from './useAcceptForm'

type Props = {
  token:         string
  workspaceId:   string
  workspaceName: string
  role:          string
  /** Existing name for the invited email, or null when brand-new. */
  existingName: string | null
}

/**
 * AcceptForm — magic-link accept. The invite token (from the invitee's email)
 * is the credential, so there's no separate sign-in: one click provisions
 * identity + a session and routes into the workspace. The name field is always
 * shown — enter it (new invitee) or confirm it (existing record).
 */
export function AcceptForm({ token, workspaceName, role, existingName }: Props) {
  const m = useT()
  const { state, accept, name, setName } = useAcceptForm({ token, existingName })

  const roleLabel = m.invite.roles[role as keyof typeof m.invite.roles] ?? role
  const isBusy = state.status === 'submitting' || state.status === 'success'
  const blocked = isBusy || name.trim().length === 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{m.invite.title}</p>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {m.invite.confirmHeading(workspaceName, roleLabel)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {existingName ? m.invite.acceptingAs(existingName) : m.invite.confirmBody}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-name">{m.invite.nameLabel}</Label>
        <Input
          id="invite-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>

      {state.status === 'error' && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="button" onClick={accept} disabled={blocked}>
        {isBusy ? m.invite.accepting : m.invite.accept}
      </Button>
    </div>
  )
}
