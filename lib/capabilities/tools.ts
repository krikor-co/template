/**
 * GENERATE an assistant's tool catalog from the Capability Registry.
 *
 * Every operation lives ONCE as a `Capability` (`lib/capabilities`). Its `ai`
 * adapter (describe + names→ids `resolve` + write `preview`/`summarize`) is all
 * an agent needs — no hand-written tool catalog that can drift from the action
 * the UI calls. Wire these into the AI SDK (`ai` package): read tools register
 * with their `execute`; WRITE tools register with NO `execute` (see below).
 *
 * SECURITY-CRITICAL invariants (unchanged from the pattern's origin):
 *   - A generated WRITE tool's `execute` (the resolve→run→summarize spine) is
 *     the SHARED `capWriteExecute(cap)` — the SAME function your confirm step
 *     dispatches to. The agent loop NEVER receives this `execute`: register
 *     writes with `tool({ description, inputSchema })` and no execute, so a
 *     model "call" only yields a PENDING PROPOSAL. Only the user's explicit
 *     confirm action ever runs it. Loop + confirm share ONE mutation spine and
 *     can never diverge.
 *   - `resolve` is workspace-scoped + read-only (names→ids against
 *     `ctx.workspaceId`); the model never sets a `workspaceId` — it comes from
 *     `ctx` inside each capability.
 *
 * See docs/capabilities.md for the full contract and wiring example.
 */

import { z } from 'zod'
import { ACTION_CAPS, QUERY_CAPS } from './registry'
import type { ActionCapability, CapCtx, CapNotFound, QueryCapability } from './types'
import { isCapNotFound } from './resolve'

/** A predefined, workspace-scoped READ tool. */
export type ReadTool = {
  name:        string
  kind:        'read'
  description: string
  parameters:  z.ZodTypeAny
  execute:     (ctx: CapCtx, args: unknown) => Promise<unknown>
}

/** The human-readable proposal a write tool resolves BEFORE any mutation. */
export type WritePreview = {
  /** Card heading — what kind of action this is. */
  title: string
  /** The resolved effect, line by line (real values). */
  lines: string[]
  /** The typed, replayable action descriptor the confirm step re-validates. */
  descriptor: { tool: string; args: Record<string, unknown> }
}

/** The result of a confirmed write — fed back as the next turn. */
export type WriteResult = {
  ok: boolean
  /** A one-line summary of what happened (success OR a soft failure). */
  summary: string
}

/** A "could not resolve this entity" preview outcome — map it to an honest refusal. */
export type WriteNotFound = CapNotFound

/** A predefined, workspace-scoped WRITE tool (propose→confirm; never loop-executed). */
export type WriteTool = {
  name:        string
  kind:        'write'
  description: string
  parameters:  z.ZodTypeAny
  /** Resolve a human preview + descriptor. PURE READ — never mutates. */
  preview:     (ctx: CapCtx, args: unknown) => Promise<WritePreview | WriteNotFound>
  /** The REAL mutation — run ONLY from your confirm step. */
  execute:     (ctx: CapCtx, args: unknown) => Promise<WriteResult>
}

/**
 * The SHARED write spine: resolve (names→ids) → run (the canonical action) →
 * summarize. Extracted so an agent loop's generated WRITE tool AND the confirm
 * step dispatch through the SAME path and can never diverge. Reads only happen
 * in `resolve`; the mutation is `cap.run`, exactly the action the UI calls.
 */
export function capWriteExecute(
  c: ActionCapability<unknown, unknown>,
): (ctx: CapCtx, args: unknown) => Promise<WriteResult> {
  return async (ctx, args) => {
    const input = await c.ai!.resolve(ctx, args)
    if (isCapNotFound(input)) return { ok: false, summary: '' } // unreachable post-preview; confirm re-resolves
    const out = await c.run(input as never)
    return c.ai!.summarize ? c.ai!.summarize(ctx, input as never, out) : { ok: true, summary: '' }
  }
}

export function readToolsFromCaps(
  caps: QueryCapability<unknown, unknown>[] = QUERY_CAPS,
): ReadTool[] {
  return caps.filter((c) => c.ai).map((c) => ({
    name: c.id, kind: 'read', description: c.ai!.describe,
    parameters: c.ai!.aiSchema ?? c.schema,
    execute: async (ctx: CapCtx, args: unknown) => {
      // `resolve` is a required adapter field (names→ids, workspace-scoped, read-only).
      const input = await c.ai!.resolve(ctx, args)
      if (isCapNotFound(input)) return input
      return c.run(input as never)
    },
  }))
}

export function writeToolsFromCaps(
  caps: ActionCapability<unknown, unknown>[] = ACTION_CAPS,
): WriteTool[] {
  return caps.filter((c) => c.ai?.preview).map((c) => ({
    name: c.id, kind: 'write', description: c.ai!.describe,
    parameters: c.ai!.aiSchema ?? c.schema,
    preview: async (ctx: CapCtx, args: unknown): Promise<WritePreview | WriteNotFound> => {
      const input = await c.ai!.resolve(ctx, args)
      if (isCapNotFound(input)) return input
      const p = await c.ai!.preview!(ctx, input as never)
      return { ...p, descriptor: { tool: c.id, args: args as Record<string, unknown> } }
    },
    execute: capWriteExecute(c),
  }))
}
