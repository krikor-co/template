---
title: Capabilities
order: 18
category: Patterns
---

# Capability Registry — One Operation, One Definition

Every app operation — "create a project", "list members", "rename a thing" — is
defined **once** as a `Capability`. The human form/page calls `cap.run`, and an
AI assistant's tool catalog is **generated** from the same registry. There is no
second copy of an operation: no hand-listed tool that can drift from the action
the UI calls, no second mutation path, no second business math.

```
Capability  =  { id, kind, schema, run, ai? }
                              │      │    │
   the canonical input ──────┘      │    └── the AI-only adapter (optional)
   the EXISTING action / query ─────┘
```

A capability is the **single source of truth** for an operation. Forms and pages
consume `run`; the assistant consumes `ai`. If an operation has no `ai`, it
simply isn't exposed to the agent — it's still the canonical way the UI performs
it. The registry ships EMPTY (`lib/capabilities/registry.ts`) — grow it with
your app.

## The type

`lib/capabilities/types.ts`:

```ts
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
```

`run` is **not new code** — it's the action/query that already exists in the
section's `actions.ts` / `query.ts`. The capability just names it and attaches
the canonical `schema` and (optionally) the AI adapter.

### `CapCtx` — the workspace-scoped context

Every capability + tool closes over the authorized, workspace-scoped `CapCtx`:
`workspaceId`, `userId`, `locale`, `timeZone`, `nowIso`. It is built ONCE, after
authorization, and shared by every tool — so an assistant is exactly as capable
as the logged-in user. `workspaceId` lives on `ctx`, **never** as an LLM
argument. Apps extend the interface via module augmentation (formatter bags,
currency, the original question — see the doc comment in `types.ts`).

## The two-schema shape: `schema` vs `ai.aiSchema` + `resolve`

| | What it is | Who validates against it |
|---|---|---|
| `schema` | the **canonical** input `run` takes (includes `workspaceId` + ids) | the form/page; your confirm step re-validates |
| `ai.aiSchema` | the **loose, name-based** args the LLM may pass (no `workspaceId`, names not ids) | the agentic loop's tool call |
| `ai.resolve` | turns loose LLM args → canonical input (names→ids, injects `workspaceId` from `ctx`) | runs server-side, **read-only** |

The model only ever names an entity; `resolve` is the workspace-scoped boundary
that turns that name into a real, owned id — or returns
`notFound(name)` (`lib/capabilities/resolve.ts`) so the tool refuses rather than
inventing a record. Resolver conventions (workspace-scoped, read-only, live
reads) and the `EntityResolver<Row>` shape live in `resolve.ts`.

## Generated tools (`lib/capabilities/tools.ts`)

- `readToolsFromCaps()` → a `ReadTool` per query cap with an `ai` block:
  `resolve → run`.
- `writeToolsFromCaps()` → a `WriteTool` per action cap with an `ai.preview`:
  `preview` resolves the human confirm card + a replayable `descriptor`;
  `execute` is the shared `capWriteExecute(cap)` spine (`resolve → run →
  summarize`).
- Both accept an optional `caps` array (defaults to the registry) — compose
  sub-catalogs or test against fakes.

**Wiring into the AI SDK** (`ai` dep, via the Vercel AI Gateway —
`AI_GATEWAY_API_KEY`): register read tools WITH their `execute`; register write
tools with `tool({ description, inputSchema })` and **NO execute**, so a model
"call" only yields a PENDING PROPOSAL your UI renders as a confirm card. Your
confirm action re-auths, re-validates the descriptor against the tool's own
`parameters`, then dispatches through the SAME `capWriteExecute(cap)`. Log every
model call with `recordAiCall` (`lib/ai/instrument.ts`) and thread the final
turn outcome (`lib/ai/outcome.ts`) for cost + refusal tracking.

## Worked example — `create_project`

A hypothetical workspace app with a ProjectForm section
(`app/workspace/[workspaceId]/(app)/projects/_sections/ProjectForm/`). Co-locate
`capability.ts` beside it:

```ts
import { z } from 'zod'
import { actionCapability } from '@/lib/capabilities/types'
import { createProject } from './actions'          // the EXISTING server action

const schema = z.object({
  workspaceId: z.string(),
  name:        z.string().trim().min(1),
})
type In = z.infer<typeof schema>

export const createProjectCap = actionCapability<In, Awaited<ReturnType<typeof createProject>>>({
  id: 'create_project', kind: 'action', schema,
  run: (input) => createProject(input),            // ← verbatim, no new logic
  ai: {
    describe: 'PROPOSE creating a new project in this workspace.',
    aiSchema: z.object({ name: z.string() }),      // no workspaceId — ever
    resolve: async (ctx, a) => ({ workspaceId: ctx.workspaceId, ...(a as { name: string }) }),
    preview: async (_ctx, input) => ({ title: 'Create project', lines: [input.name] }),
    summarize: (_ctx, input, out) =>
      (out as { success: boolean }).success
        ? { ok: true, summary: `Created "${input.name}"` }
        : { ok: false, summary: 'Could not create the project' },
  },
})
```

Register it in `lib/capabilities/registry.ts` (`import` → add to `ALL`). The
**ProjectForm** calls `createProjectCap.run(payload)`; the **assistant** gets a
generated `create_project` write tool. Both paths execute the same
`createProject` action.

## Adding a capability

1. **Co-locate** `capability.ts` beside the section that owns the operation.
   `run` = the EXISTING action/query; `schema` = the canonical input.
2. If the assistant should use it, add the `ai` block: `describe`, optional
   `aiSchema`, `resolve` (names→ids + `workspaceId` from `ctx`), and for writes
   `preview` + `summarize`.
3. **Register** it in `lib/capabilities/registry.ts`.
4. **Repoint** the human form/page to call `cap.run`.
5. **Verify:** `tsc` clean; the human screen still works; the generated tool
   appears in `readToolsFromCaps()`/`writeToolsFromCaps()`.

## Invariants (do not break)

- **Writes never auto-execute.** Action caps register in an agent loop with
  **no** `execute`; the model can only PROPOSE.
- **Your confirm action is the SOLE mutation path** for the assistant:
  re-auth → re-validate → resolve → `cap.run` → audit.
- **`workspaceId` comes from `ctx`**, never an LLM field; `resolve` is read-only.
- **The loop and confirm share `capWriteExecute(cap)`** — one
  `resolve → run → summarize`, so they can never diverge.
- **Capabilities never navigate** or import route contracts. Navigation stays in
  Flow sections (`route.exits.*()`). Auth stays inside `run`
  (`requireWorkspaceRoleE` / `requireSessionE`).
