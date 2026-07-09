import { useState } from 'react'

/**
 * Controlled/uncontrolled text management for {@link AskAi} (HOOK-1: hooks live
 * in a companion `useXxx.ts`, not inline in the component body — matching the
 * sibling `useMoneyInput`/`usePhoneInput` primitives). Pass `value` + `onChange`
 * to control the text, else it keeps its own local value. `clear()` resets only
 * the uncontrolled path.
 */
export function useAskAi(value: string | undefined, onChange?: (next: string) => void) {
  const [local, setLocal] = useState('')
  const isControlled = value !== undefined
  const text = isControlled ? value : local

  const setText = (next: string) => {
    if (isControlled) onChange?.(next)
    else setLocal(next)
  }

  const clear = () => {
    if (!isControlled) setLocal('')
  }

  return { text, setText, clear }
}
