import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Actor context — marks WHO/WHAT initiated the current server operation so a
 * trace span can distinguish AI-INITIATED work (an assistant running a capability
 * the user confirmed) from a direct human action. Without this, an AI-run action is
 * attributed to the confirming user's `userId` and looks like the human did it.
 *
 * Set by the assistant's confirm path (`withActor('assistant', …)`); read by
 * `runAction` when stamping the boundary span (`attributes.actor`). Propagates
 * across `await` via AsyncLocalStorage, so a capability's inner `runAction`
 * (nested under the confirm) inherits it. The user's `userId` is STILL captured
 * (for audit) — `actor` is the orthogonal "this was AI-initiated" marker.
 */
export type Actor = 'assistant' | 'system'

const actorStore = new AsyncLocalStorage<Actor>()

/** Run `fn` with the given actor in async context (AI confirm path → 'assistant'). */
export function withActor<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  return actorStore.run(actor, fn)
}

/** The actor for the current async context, or undefined for a direct human action. */
export function currentActor(): Actor | undefined {
  return actorStore.getStore()
}
