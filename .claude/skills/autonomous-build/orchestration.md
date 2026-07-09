# Fleet orchestration (Workflow fan-out)

How to fan large work out to many subagents and get coherent, verified output. Lessons from ~56-file migration and whole-app redesign fleets on apps built from this template.

## The rule: foundation first, then fan out

N parallel agents produce N different interpretations unless they share a foundation. Before any fan-out:
1. **Build the shared dependency yourself** — the thing every agent imports/follows (e.g. the design-system tokens + primitives, a new shared util, the migration's target API). It must be *correct*; everything inherits it.
2. **Write a guide doc** the agents read (`.claude/specs/_<name>.md`) — the single source of truth (patterns, tokens, do/don't, the exact primitive signatures).
3. **Build one reference implementation** and point agents at it ("match `app/.../page.tsx`"). For a redesign, do the reference in Phase 1 of the workflow (sequential), then fan out Phase 2 referencing it.

Then fan out. The guide + reference are what make 23 agents land as one coherent app instead of 23 vibes.

## Scoping agents

- **One agent per folder, not per file.** A folder of related files gives the agent context to be coherent and keeps file ownership disjoint → no write conflicts. Per-file agents lose cross-file coherence.
- **Disjoint ownership.** Each agent edits ONLY its folder. Forbid shared-file edits: `lib/i18n/messages.ts`, `components/ui/*`, `app/globals.css`, `tailwind.config.ts`. If a component is reused across folders, exactly one agent owns it; others compose it.
- **No-i18n / no-logic for visual or mechanical sweeps** — keeps edits presentational and conflict-free.
- **Structured output** — give every agent a `schema` so it returns `{filesChanged, eslintClean, notes}` cleanly instead of prose.
- **effort** — `low` for mechanical swaps, `high` for design/judgment work.
- **Agents self-verify cheaply** (`eslint` their own files) but DON'T run full `tsc` ×N (too slow). You run the global `tsc` after.

## Workflow script gotchas

- **Inline the work-list as a JS literal.** The `args` input arrives unreliably (it reached the script as a non-array twice → `pipeline() expects an array`). Hardcode `const areas = [ ... ]` in the script body. Don't depend on `args`.
- `meta` must be a pure literal (no computed values). Phase titles in `meta.phases` must match `phase()` calls.
- `parallel(thunks)` is a barrier returning all results (use `.filter(Boolean)`); `pipeline(items, ...stages)` has no barrier between stages. For disjoint folder-agents, `parallel(areas.map(a => () => agent(...)))` is right.
- Concurrency caps at ~`min(16, cores-2)`; extra agents queue. A 23-agent fan-out runs in ~2 waves.
- Iterate without resending: the tool returns a `scriptPath`; edit it + re-invoke with `{scriptPath}` (+ `resumeFromRunId` to reuse cached agent results).

## After the workflow — YOU verify globally

Agents report `eslintClean`; trust nothing until you check ground truth:
1. **Full `tsc`** — the real test of N parallel edits (catches cross-file breakage agents can't see).
2. **eslint** the whole touched tree; distinguish NEW vs pre-existing (`git show HEAD:file | eslint --stdin`).
3. **Render-smoke** every role/auth surface (`visit.mjs`, each workspace role + logged-out) — HTTP 200 + 0 console errors.
4. **Read screenshots** of key pages — actually look; 200/0-errors ≠ visually correct.
5. Fix regressions yourself, then commit the sweep as one descriptive commit.

## Opt-in

Only run a Workflow when the user has opted into multi-agent orchestration (explicit "use a workflow" / "spawn agents" / a standing "go all-in"/"overnight" instruction). It can spend a lot of tokens; the scale must be the user's call.
