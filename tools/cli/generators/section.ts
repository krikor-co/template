import * as path from 'path'
import { writeFile, toComponentName } from '../fs'

type Options = {
  client: boolean
  fetches: boolean
  mutates: boolean
}

export async function generateSection(target: string, opts: Options): Promise<void> {
  if (!target.includes('_components')) {
    console.error('Error: Sections must be inside _components/. Use: flow g section app/<route>/_components/<Name>')
    process.exit(1)
  }

  const dir = target
  const name = toComponentName(target)

  const label = [
    opts.client ? 'client' : 'server',
    opts.fetches ? '+ fetches' : '',
    opts.mutates ? '+ mutates' : '',
  ]
    .filter(Boolean)
    .join(' ')

  console.log(`\nGenerating section: ${name} (${label})\n`)

  // ── Always generated ──────────────────────────────────────────

  writeState(dir, name, opts)
  writeFixtures(dir, name, opts)
  writeComponent(dir, name, opts)
  writeStories(dir, name, opts)

  // ── Client section ────────────────────────────────────────────

  if (opts.client) {
    writeTransition(dir, name)
    writeScene(dir)
  }

  // ── Fetches ───────────────────────────────────────────────────

  if (opts.fetches && !opts.client) {
    writeDeps(dir, name)
    writeQuery(dir, name)
    writeTags(dir)
  }

  if (opts.fetches && opts.client) {
    writeActions(dir, name, { loader: true, mutation: opts.mutates })
    writeLoader(dir, name)
  }

  // ── Mutates only (no client fetch already handling actions) ──

  if (opts.mutates && !(opts.fetches && opts.client)) {
    writeActions(dir, name, { loader: false, mutation: true })
  }

  console.log('\nDone. Next steps:')
  console.log('  1. Define state variants in state.ts')
  console.log('  2. Update fixtures to match state variants')
  if (opts.client) console.log('  3. Implement transitions in transition.ts')
  if (opts.fetches) console.log('  3. Wire up data fetching')
  if (opts.mutates) console.log('  4. Implement server actions in actions.ts')
}

// ── Template writers ──────────────────────────────────────────────

function writeState(dir: string, _name: string, opts: Options): void {
  if (opts.client) {
    writeFile(
      path.join(dir, 'state.ts'),
      `export type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error';   message: string }
  | { status: 'success'; redirectTo: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'ERROR';   message: string }
  | { type: 'RETRY' }
`,
    )
  } else {
    writeFile(
      path.join(dir, 'state.ts'),
      `export type State =
  | { status: 'idle' }
  | { status: 'error'; message: string }
`,
    )
  }
}

function writeFixtures(dir: string, _name: string, opts: Options): void {
  if (opts.client) {
    writeFile(
      path.join(dir, 'fixtures.ts'),
      `import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle' }                                        satisfies State,
  submitting: { status: 'submitting' }                                  satisfies State,
  error:      { status: 'error',   message: 'Something went wrong.' }   satisfies State,
  success:    { status: 'success', redirectTo: '/TODO' }                satisfies State,
}
`,
    )
  } else {
    writeFile(
      path.join(dir, 'fixtures.ts'),
      `import type { State } from './state'

export const fixtures = {
  idle:  { status: 'idle' }                                    satisfies State,
  error: { status: 'error', message: 'Something went wrong.' } satisfies State,
}
`,
    )
  }
}

function writeComponent(dir: string, name: string, opts: Options): void {
  if (opts.client && opts.mutates) {
    writeFile(
      path.join(dir, `${name}.tsx`),
      `'use client'

import { scene } from './scene'
import { submitAction } from './actions'
import type { State } from './state'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useFormValues } from '@/lib/hooks/useFormValues'

export function ${name}({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  useRedirectOnSuccess(state, [reset, form.reset])

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await submitAction(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: 'TODO' })
    else send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <form action={handleSubmit} className="space-y-4">
          {/* TODO: add fields with defaultValue={form.values.xxx} */}
          {state.status === 'error' && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <button type="submit" disabled={state.status === 'submitting'}>
            {state.status === 'submitting' ? 'Saving…' : 'Save'}
          </button>
        </form>
      )
    case 'success':
      return (
        <form className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
          {/* TODO: mirror fields with disabled */}
          <p className="text-sm text-muted-foreground">Redirecting…</p>
          <button type="button" disabled>Redirecting…</button>
        </form>
      )
  }
}
`,
    )
  } else if (opts.client) {
    writeFile(
      path.join(dir, `${name}.tsx`),
      `'use client'

import { scene } from './scene'
import type { State } from './state'

export function ${name}({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)

  switch (state.status) {
    case 'idle':
      return <div>TODO: idle</div>
    case 'submitting':
      return <div>Submitting…</div>
    case 'error':
      return (
        <div>
          <p>{state.message}</p>
          <button onClick={() => send({ type: 'RETRY' })}>Retry</button>
        </div>
      )
    case 'success':
      return <div>Done. Redirecting…</div>
  }
}
`,
    )
  } else {
    writeFile(
      path.join(dir, `${name}.tsx`),
      `import type { State } from './state'

export function ${name}({ state }: { state: State }) {
  switch (state.status) {
    case 'idle':
      return <div>TODO: idle</div>
    case 'error':
      return <div>{state.message}</div>
  }
}
`,
    )
  }
}

function writeStories(dir: string, name: string, opts: Options): void {
  const propName = opts.client ? 'initialState' : 'state'
  const params = opts.client
    ? `{ nextjs: { appDirectory: true }, shell: true }`
    : `{ nextjs: { appDirectory: true } }`

  const stories = opts.client
    ? `export const Idle: Story       = { args: { ${propName}: fixtures.idle } }
export const Submitting: Story = { args: { ${propName}: fixtures.submitting } }
export const Error: Story      = { args: { ${propName}: fixtures.error } }
export const Success: Story    = { args: { ${propName}: fixtures.success } }`
    : `export const Idle: Story  = { args: { ${propName}: fixtures.idle } }
export const Error: Story = { args: { ${propName}: fixtures.error } }`

  writeFile(
    path.join(dir, `${name}.stories.tsx`),
    `import type { Meta, StoryObj } from '@storybook/react'
import { ${name} } from './${name}'
import { fixtures } from './fixtures'

const meta: Meta<typeof ${name}> = {
  component: ${name},
  parameters: ${params},
}
export default meta
type Story = StoryObj<typeof ${name}>

${stories}
`,
  )
}

function writeTransition(dir: string, _name: string): void {
  writeFile(
    path.join(dir, 'transition.ts'),
    `import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
    case 'submitting':
      if (event.type === 'ERROR')   return { status: 'error', message: event.message }
      if (event.type === 'SUCCESS') return { status: 'success', redirectTo: event.redirectTo }
      break
    case 'error':
      if (event.type === 'RETRY')  return { status: 'idle' }
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
  }
  return state
}
`,
  )
}

function writeScene(dir: string): void {
  writeFile(
    path.join(dir, 'scene.ts'),
    `import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
`,
  )
}

function writeDeps(dir: string, name: string): void {
  const queryFn = `get${name}State`
  writeFile(
    path.join(dir, 'deps.ts'),
    `import { ${queryFn} } from './query'

export type Deps = {
  getState: () => Promise<import('./state').State>
}

export const defaultDeps: Deps = {
  getState: ${queryFn},
}
`,
  )
}

function writeQuery(dir: string, name: string): void {
  const queryFn = `get${name}State`
  writeFile(
    path.join(dir, 'query.ts'),
    `import { Tag, tagWith } from './tags'
import type { State } from './state'

export async function ${queryFn}(): Promise<State> {
  'use cache'
  tagWith(Tag.TODO({}))

  // TODO: fetch data
  return { status: 'idle' }
}
`,
  )
}

function writeTags(dir: string): void {
  writeFile(
    path.join(dir, 'tags.ts'),
    `import { createTagRegistry } from '@/lib/cache-registry'

export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
  // TODO: define tag resolvers
  // example: items: (_: Record<string, never>) => ['items'] as const,
  // example: item:  (p: { id: string })        => ['items', \`item:\${p.id}\`] as const,
})
`,
  )
}

function writeActions(
  dir: string,
  _name: string,
  opts: { loader: boolean; mutation: boolean },
): void {
  const parts: string[] = [`'use server'\n`]

  if (opts.loader) {
    parts.push(`export async function loadData(
  // TODO: add params
): Promise<unknown> {
  // TODO: fetch data and return result
  return null
}
`)
  }

  if (opts.mutation) {
    parts.push(`export async function submitAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  // TODO: validate, mutate, invalidate cache
  return { success: true }
}
`)
  }

  writeFile(path.join(dir, 'actions.ts'), parts.join('\n'))
}

function writeLoader(dir: string, name: string): void {
  const hookName = `use${name}Loader`
  writeFile(
    path.join(dir, `${hookName}.ts`),
    `import { useEffect } from 'react'
import type { State, Event } from './state'
import type { Send } from '@/lib/scene'
import { loadData } from './actions'

export function ${hookName}(state: State, send: Send<Event>) {
  useEffect(() => {
    // TODO: implement loading logic
    // if (state.status !== 'loading') return
    // let cancelled = false
    // loadData(...).then(
    //   (data) => { if (!cancelled) send({ type: 'SUCCESS', ...data }) },
    //   (e)    => { if (!cancelled) send({ type: 'ERROR', message: (e as Error).message }) },
    // )
    // return () => { cancelled = true }
  }, [state, send])
}
`,
  )
}
