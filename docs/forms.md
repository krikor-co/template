---
title: Forms
order: 5
category: Patterns
---

# Forms

## Why forms need their own pattern

A form section is a Type 5 client section (state machine + server action) with an extra concern: **input values**. The scene owns status transitions (`idle` / `submitting` / `error` / `success`). But who owns what the user typed?

React 19 answers this question for us — and creates a problem. When a `<form action={fn}>` resolves, React calls `form.reset()` on the DOM, clearing every uncontrolled input. This happens whether the action succeeded or returned an error (React resets when the promise resolves, not when the result is "successful").

The `useFormValues` hook solves this. It captures form values on submit and exposes them as `defaultValue` sources that survive the reset.

---

## The three-hook pattern

Every form section uses three hooks:

```tsx
const [state, send, reset] = scene.useScene(initialState)   // status lifecycle
const form = useFormValues()                                  // input values + errors + validation
useRedirectOnSuccess(state, [reset, form.reset])              // navigation after success
```

Scene doesn't know forms exist. The form hook doesn't know scenes exist. The component coordinates them.

---

## Layer 1: Value capture and persistence

### The problem

```tsx
<form action={handleSubmit}>
  <input name="email" placeholder="you@example.com" />
</form>
```

User types "alice@example.com", submits, action returns an error. React calls `form.reset()`. The input is now empty. The user has to retype their email.

### The solution

```tsx
const form = useFormValues()

const handleSubmit = async (formData: FormData) => {
  form.capture(formData)                    // snapshot values before anything else
  send({ type: 'SUBMIT' })
  const result = await action(formData)
  if (result.success) send({ type: 'SUCCESS', redirectTo: route.exits.next() })
  else send({ type: 'ERROR', message: result.error })
}
```

```tsx
<form action={handleSubmit}>
  <input name="email" defaultValue={form.values.email} placeholder="you@example.com" />
</form>
```

`capture(formData)` reads every string field from FormData into `form.values`. This triggers a state update that batches with `send()` — one re-render, the DOM gets the new `defaultValue` before `form.reset()` fires.

### Timeline

```
1. User types "alice@example.com"
2. User clicks submit → action fires
3. form.capture(formData)     → form.values = { email: "alice@example.com" }
4. send({ type: 'SUBMIT' })  → scene = { status: 'submitting' }
5. React batches 3+4 into one re-render → input gets defaultValue="alice@example.com"
6. Server action runs → returns error
7. send({ type: 'ERROR' })   → scene = { status: 'error', message: '...' }
8. Action resolves → React calls form.reset()
9. Input resets to defaultValue → "alice@example.com" ✓
```

### Both switch arms use the same defaultValue

```tsx
// Active arm
<Input name="email" defaultValue={form.values.email} />

// Success arm (disabled, faded)
<Input name="email" defaultValue={form.values.email} disabled />
```

Before the first submit, `form.values.email` is `undefined` — the input shows the placeholder. After submit, it holds the captured value.

---

## Layer 2: Field errors

Actions can return per-field errors alongside a general message:

```ts
{ success: false, error: 'Validation failed', fieldErrors: { email: 'Already registered' } }
```

Scene carries the top-level message. Field-level errors belong to the form hook.

### Setting errors from the action result

```tsx
const handleSubmit = async (formData: FormData) => {
  form.capture(formData)
  send({ type: 'SUBMIT' })
  const result = await action(formData)
  if (result.success) {
    send({ type: 'SUCCESS', redirectTo: route.exits.next() })
  } else {
    if (result.fieldErrors) form.setErrors(result.fieldErrors)
    send({ type: 'ERROR', message: result.error })
  }
}
```

### Displaying errors

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" name="email" defaultValue={form.values.email} />
  {form.errors.email && (
    <p className="text-sm text-destructive">{form.errors.email}</p>
  )}
</div>

{state.status === 'error' && !Object.keys(form.errors).length && (
  <p className="text-sm text-destructive">{state.message}</p>
)}
```

Show the top-level scene message only when there are no field errors — otherwise it's redundant.

### When errors clear

On the next `capture()` call. New submission = fresh slate for both values and errors.

### Clearing values on redirect

`useRedirectOnSuccess` resets the scene state after `router.push`. But `form.values` is separate state — if you only reset the scene, captured form values survive. The Next.js Router Cache can reconcile (rather than remount) the component on a later visit, and `defaultValue={form.values.email}` would pre-fill the input with stale data.

Fix: pass both reset functions to `useRedirectOnSuccess`:

```tsx
useRedirectOnSuccess(state, [reset, form.reset])
```

The hook accepts a single function or an array. All functions are called after the redirect fires. This ensures both scene status and form values are cleared before navigating away.

### Who owns what

| Error type | Owner | Example |
|---|---|---|
| General / top-level | Scene (`state.message`) | "Network error", "Rate limited" |
| Per-field from server | `useFormValues` (`form.errors`) | "Email already taken" |
| Per-field from client | `useFormValues` (`form.errors`) | "Invalid email", "Required" |

---

## Layer 3: Per-field client validation

Attach a validation function to an input. It validates on blur, clears on edit, and blocks submit if invalid.

### `form.field(name, options?)`

Returns a props object to spread on an Input:

```tsx
<Input id="email" {...form.field('email', {
  validate: (value) => {
    if (!value) return 'Required'
    if (!value.includes('@')) return 'Invalid email'
    return null
  }
})} />
{form.errors.email && (
  <p className="text-sm text-destructive">{form.errors.email}</p>
)}
```

`form.field('email', { validate })` returns:

```ts
{
  name: 'email',
  defaultValue: form.values.email,
  onBlur:    /* run validator, set/clear error */,
  onChange:   /* clear this field's error */,
}
```

The Input primitive stays dumb — standard HTML input props. The hook generates the handlers.

### Fields without validation

`form.field('name')` with no options still returns `{ name, defaultValue, onBlur, onChange }` — value persistence for free.

### What happens on submit

`form.capture(formData)` runs all registered validators. If any fail, `capture` returns `false` and sets errors. The component gates the action:

```tsx
const handleSubmit = async (formData: FormData) => {
  if (!form.capture(formData)) return   // validation failed, don't proceed
  send({ type: 'SUBMIT' })
  const result = await action(formData)
  // ...
}
```

When validation fails, the action still resolves (the function returns early). React calls `form.reset()`, but `defaultValue` is already set, so input values are preserved. Errors display immediately. Scene never leaves `idle`.

---

## Layer 4: Cross-field validation

When one input's validity depends on another's value — password + confirm, start date < end date.

This is the case where controlled inputs (`useState`) are justified per the framework convention.

### Top-level validator

```tsx
const [password, setPassword] = useState('')
const [confirm, setConfirm] = useState('')

const form = useFormValues({
  validate: (values) => {
    if (values.password && values.confirm && values.password !== values.confirm) {
      return { confirm: 'Passwords must match' }
    }
    return null
  }
})
```

### Execution order in `capture`

```
1. Snapshot all values into form.values
2. Clear previous errors
3. Run per-field validators     → if any fail → set errors → return false
4. Run top-level validator      → if fails    → set errors → return false
5. All passed                   → return true
```

### Controlled fields in JSX

Controlled inputs don't use `form.field()` — they manage their own `value`:

```tsx
<form action={handleSubmit}>
  <Input name="password" type="password"
    value={password} onChange={(e) => setPassword(e.target.value)} />
  <Input name="confirm" type="password"
    value={confirm} onChange={(e) => setConfirm(e.target.value)} />
  {form.errors.confirm && (
    <p className="text-sm text-destructive">{form.errors.confirm}</p>
  )}
</form>
```

Controlled inputs don't need `defaultValue` — React re-applies `value` after `form.reset()`.

---

## Full API

```ts
const form = useFormValues({
  validate?: (values: Record<string, string>) => Record<string, string> | null
})

form.values                          // Record<string, string> — last captured snapshot
form.errors                          // Record<string, string> — current field errors
form.capture(formData)               // snapshot + validate all → boolean
form.setErrors(errors)               // set server-returned field errors
form.field(name, { validate? })      // returns input props: name, defaultValue, onBlur, onChange
form.reset()                         // clear all values and errors
```

## Responsibility map

| Concern | Owner |
|---|---|
| Status transitions (idle/submitting/error/success) | `useScene` |
| Input values + field errors + validation | `useFormValues` |
| Navigation after success | `useRedirectOnSuccess` |
| Server mutation | server action via `<form action={fn}>` |

---

## Controlled vs uncontrolled

| | Uncontrolled (default) | Controlled |
|---|---|---|
| Props | `defaultValue={form.values.email}` | `value={localEmail} onChange={...}` |
| Re-renders on keystroke | No | Yes |
| Survives form.reset() | Via `defaultValue` from hook | React re-applies `value` |
| When to use | Most inputs | When inputs depend on each other's values |
| Uses `form.field()`? | Yes | No — manages its own `value`/`onChange` |

---

## Worked example: LoginForm

```tsx
'use client'

import { scene } from './scene'
import { sendLoginOtp } from './actions'
import type { State } from './state'
import { route } from '../../contract'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useFormValues } from '@/lib/hooks/useFormValues'

export function LoginForm({ initialState, returnTo }: { initialState: State; returnTo?: string }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  useRedirectOnSuccess(state, [reset, form.reset])

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await sendLoginOtp(formData)
    if (result.success) send({ type: 'SUCCESS', redirectTo: result.isNew ? route.exits.register() : route.exits.verify() })
    else send({ type: 'ERROR', message: result.error })
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <form action={handleSubmit} className="space-y-4">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" name="email" type="email"
              autoComplete="email" required
              defaultValue={form.values.email}
              onChange={() => { if (state.status === 'error') send({ type: 'RETRY' }) }}
              placeholder="you@example.com"
            />
          </div>
          {state.status === 'error' && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <Button type="submit" disabled={state.status === 'submitting'}>
            {state.status === 'submitting' ? 'Checking for account…' : 'Log in'}
          </Button>
        </form>
      )
    case 'success':
      return (
        <form className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" disabled
              defaultValue={form.values.email} placeholder="you@example.com" />
          </div>
          <p className="text-sm text-muted-foreground">Redirecting…</p>
          <Button type="button" disabled>Redirecting…</Button>
        </form>
      )
  }
}
```

The state machine is pure status — no form values:

```ts
export type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error';   message: string }
  | { status: 'success'; redirectTo: string }
```
