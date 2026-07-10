import { z } from 'zod'
import type { Locale } from '@/lib/i18n/types'

/**
 * The authorized, workspace-scoped context every capability + AI tool closes
 * over. Built ONCE, AFTER the user is authorized on `workspaceId`, and captured
 * in a closure shared by every tool — a tool can only ever read/write data for
 * `ctx.workspaceId`, so an assistant is EXACTLY as capable as the logged-in
 * user. `workspaceId` is never a tool argument the model can set.
 *
 * Apps extend it (formatter bags, currency, the original question, …) via
 * module augmentation:
 *
 *   declare module '@/lib/capabilities/types' {
 *     interface CapCtx { currency: string; money: (n: number) => string }
 *   }
 */
export interface CapCtx {
  /** The ONLY workspace any tool may touch — fixed at authorization, never an arg. */
  workspaceId: string
  /** The acting user (for audit / rate-limit attribution). */
  userId:      string
  locale:      Locale
  timeZone:    string
  /** The instant `ctx` was built, as an ISO/UTC string — the assistant's "now". */
  nowIso:      string
}

export type CapNotFound = { error: 'not_found'; searchedFor: string }
export type CapPreview  = { title: string; lines: string[] }

/** The AI-only adapter. Present ⇒ the capability is exposed to the agent. */
export type AiAdapter<In> = {
  describe:   string
  /** LLM-facing args (names). Defaults to the capability `schema` when omitted. */
  aiSchema?:  z.ZodTypeAny
  /** Turn loose LLM args into the canonical input (names→ids). Reads only. */
  resolve:    (ctx: CapCtx, aiArgs: unknown) => Promise<In | CapNotFound>
  /** Confirm-card text (writes only). */
  preview?:   (ctx: CapCtx, input: In) => Promise<CapPreview>
  /** Map the canonical action result → a one-line confirm summary (writes only). */
  summarize?: (ctx: CapCtx, input: In, out: unknown) => { ok: boolean; summary: string }
}

export type ActionCapability<In, Out> = {
  id: string; kind: 'action'
  schema: z.ZodType<In>
  run: (input: In) => Promise<Out>           // the EXISTING server action
  ai?: AiAdapter<In>
}
export type QueryCapability<In, Out> = {
  id: string; kind: 'query'
  schema: z.ZodType<In>
  run: (input: In) => Promise<Out>           // the EXISTING 'use cache' query
  ai?: Pick<AiAdapter<In>, 'describe' | 'aiSchema' | 'resolve'>
}
export type Capability = ActionCapability<unknown, unknown> | QueryCapability<unknown, unknown>

export function actionCapability<In, Out>(c: ActionCapability<In, Out>): ActionCapability<In, Out> { return c }
export function queryCapability<In, Out>(c: QueryCapability<In, Out>): QueryCapability<In, Out> { return c }
