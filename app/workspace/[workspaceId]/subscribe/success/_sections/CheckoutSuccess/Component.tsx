'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { Tile } from '@/components/ui/Tile'
import { IconChip } from '@/components/ui/IconChip'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useT } from '@/lib/i18n/LocaleProvider'
import { route } from '../../contract'
import { scene } from './scene'
import { fixtures } from './fixtures'
import { usePollActive } from './usePollActive'
import type { State } from './state'

type Props = {
  workspaceId:   string
  initialState?: State
}

/**
 * CheckoutSuccess — post-Stripe-Checkout return.
 *
 * The page already attempted an immediate sync from the Checkout Session. If
 * the subscription is still settling (webhook race), this section polls until
 * the workspace reads active, then forwards home via `useRedirectOnSuccess`.
 * Renders a calm "activating…" state meanwhile.
 */
export function CheckoutSuccess({ workspaceId, initialState }: Props) {
  const [state, send, reset] = scene.useScene(initialState ?? fixtures.pending)
  useRedirectOnSuccess(state, reset, 300)
  usePollActive(state, send, { workspaceId, forwardHref: route.exits.home({ workspaceId }) })
  const m = useT().subscribe.success

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <Tile tone="accent" className="flex w-full flex-col items-center gap-5 p-10">
        <IconChip tone="plain" size="lg" className="bg-accent-foreground/15 text-accent-foreground">
          {state.status === 'success' ? <Sparkles aria-hidden /> : <Loader2 aria-hidden className="animate-spin" />}
        </IconChip>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-accent-foreground">{m.title}</h1>
          <p className="text-sm text-accent-foreground/75">{m.subtitle}</p>
        </div>
        <p className="text-xs text-accent-foreground/55">{m.retry}</p>
      </Tile>
    </main>
  )
}
