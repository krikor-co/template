---
title: Storybook
order: 8
category: Patterns
---

# Storybook

Storybook is configured in `.storybook/` and stories are co-located with their components.

## Story placement

| Layer | File location |
|-------|--------------|
| Section | `_components/[Name]/[Name].stories.tsx` |
| Shell | `lib/shell.stories.tsx` |
| Page (visual reconstruction) | `app/[route]/page.stories.tsx` |
| Primitive | `components/ui/[Name]/[Name].stories.tsx` |

Glob patterns registered in `.storybook/main.ts`:

```ts
stories: [
  '../app/**/*.stories.tsx',
  '../components/**/*.stories.tsx',
  '../lib/shell.stories.tsx',
]
```

## Section stories

One named export per `fixtures` key. Pass the fixture as `initialState`. Server actions are mocked automatically by `@storybook/nextjs` — no extra setup needed for `'use client'` components.

```tsx
// RegisterForm/RegisterForm.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { RegisterForm } from './RegisterForm'
import { fixtures } from './fixtures'

const meta: Meta<typeof RegisterForm> = {
  component: RegisterForm,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof RegisterForm>

export const Idle: Story       = { args: { initialState: fixtures.idle } }
export const Submitting: Story = { args: { initialState: fixtures.submitting } }
export const Error: Story      = { args: { initialState: fixtures.error } }
```

## Shell stories

Live in `lib/shell.stories.tsx`. One story per shell variant. Modal and Drawer pass `open` as `true` and a no-op `onClose` to show the open state.

## Page stories

Page stories reconstruct the visual layout using fixture data — they do **not** call the async page function (which requires cookies, DB, and guards). Import the Shell and Section directly and compose them with the fixture state you want to show.

```tsx
// app/auth/register/page.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { RegisterForm } from './_components/RegisterForm/RegisterForm'
import { fixtures } from './_components/RegisterForm/fixtures'

const meta: Meta = { title: 'Pages/Auth/Register' }
export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <RegisterForm initialState={fixtures.idle} />
      </div>
    </div>
  ),
}
```

## Primitive stories

Co-located in `components/ui/[Name]/[Name].stories.tsx`. Standard args pattern — no state machine, just prop variants.

## Running Storybook

```bash
npm run storybook        # dev server at localhost:6006
npm run build-storybook  # static export
```
