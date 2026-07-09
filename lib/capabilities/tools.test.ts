import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  actionCapability,
  queryCapability,
  type ActionCapability,
  type CapCtx,
  type QueryCapability,
} from './types'
import { notFound } from './resolve'
import { capWriteExecute, readToolsFromCaps, writeToolsFromCaps } from './tools'

const ctx: CapCtx = {
  workspaceId: '1',
  userId:      '7',
  locale:      'en',
  timeZone:    'UTC',
  nowIso:      '2026-07-08T00:00:00.000Z',
}

const echoQuery = queryCapability({
  id: 'echo_query',
  kind: 'query',
  schema: z.object({ workspaceId: z.string(), value: z.string() }),
  run: async (input) => ({ echoed: input.value, scope: input.workspaceId }),
  ai: {
    describe: 'Echo a value back',
    aiSchema: z.object({ value: z.string() }),
    // names→ids: injects workspaceId from ctx; 'missing' simulates a non-match.
    resolve: async (c, args) => {
      const a = args as { value: string }
      if (a.value === 'missing') return notFound(a.value)
      return { workspaceId: c.workspaceId, value: a.value }
    },
  },
}) as QueryCapability<unknown, unknown>

const silentQuery = queryCapability({
  id: 'silent_query',
  kind: 'query',
  schema: z.object({ workspaceId: z.string() }),
  run: async () => ({ ok: true }),
  // no `ai` adapter → NOT exposed to the agent
}) as QueryCapability<unknown, unknown>

const renameAction = actionCapability({
  id: 'rename_thing',
  kind: 'action',
  schema: z.object({ workspaceId: z.string(), id: z.number(), name: z.string() }),
  run: async (input) => ({ success: true as const, renamedTo: input.name }),
  ai: {
    describe: 'PROPOSE renaming a thing',
    aiSchema: z.object({ name: z.string() }),
    resolve: async (c, args) => {
      const a = args as { name: string }
      if (a.name === 'missing') return notFound(a.name)
      return { workspaceId: c.workspaceId, id: 42, name: a.name }
    },
    preview: async (_c, input) => ({ title: 'Rename', lines: [`→ ${input.name}`] }),
    summarize: (_c, input, out) =>
      (out as { success: boolean }).success
        ? { ok: true, summary: `Renamed to ${input.name}` }
        : { ok: false, summary: 'Rename failed' },
  },
}) as ActionCapability<unknown, unknown>

const previewlessAction = actionCapability({
  id: 'no_preview_action',
  kind: 'action',
  schema: z.object({ workspaceId: z.string() }),
  run: async () => ({ success: true as const }),
  ai: {
    describe: 'Has ai but no preview',
    resolve: async (c) => ({ workspaceId: c.workspaceId }),
  },
}) as ActionCapability<unknown, unknown>

describe('readToolsFromCaps', () => {
  it('generates a read tool per ai-exposed query cap only', () => {
    const tools = readToolsFromCaps([echoQuery, silentQuery])
    expect(tools.map((t) => t.name)).toEqual(['echo_query'])
    expect(tools[0]!.kind).toBe('read')
    expect(tools[0]!.description).toBe('Echo a value back')
  })

  it('executes resolve → run with ctx-injected workspaceId', async () => {
    const [tool] = readToolsFromCaps([echoQuery])
    await expect(tool!.execute(ctx, { value: 'hi' })).resolves.toEqual({
      echoed: 'hi',
      scope:  '1',
    })
  })

  it('short-circuits a not_found resolve without running the query', async () => {
    const [tool] = readToolsFromCaps([echoQuery])
    await expect(tool!.execute(ctx, { value: 'missing' })).resolves.toEqual({
      error: 'not_found',
      searchedFor: 'missing',
    })
  })

  it('defaults to the (empty) registry', () => {
    expect(readToolsFromCaps()).toEqual([])
  })
})

describe('writeToolsFromCaps', () => {
  it('only exposes action caps that have a preview', () => {
    const tools = writeToolsFromCaps([renameAction, previewlessAction])
    expect(tools.map((t) => t.name)).toEqual(['rename_thing'])
  })

  it('preview resolves names→ids then attaches the replayable descriptor', async () => {
    const [tool] = writeToolsFromCaps([renameAction])
    await expect(tool!.preview(ctx, { name: 'New' })).resolves.toEqual({
      title: 'Rename',
      lines: ['→ New'],
      descriptor: { tool: 'rename_thing', args: { name: 'New' } },
    })
  })

  it('preview surfaces not_found instead of a card', async () => {
    const [tool] = writeToolsFromCaps([renameAction])
    await expect(tool!.preview(ctx, { name: 'missing' })).resolves.toEqual({
      error: 'not_found',
      searchedFor: 'missing',
    })
  })

  it('capWriteExecute runs the shared resolve → run → summarize spine', async () => {
    const execute = capWriteExecute(renameAction)
    await expect(execute(ctx, { name: 'New' })).resolves.toEqual({
      ok: true,
      summary: 'Renamed to New',
    })
  })

  it('defaults to the (empty) registry', () => {
    expect(writeToolsFromCaps()).toEqual([])
  })
})
