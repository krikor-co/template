import { useState, useCallback, useRef, useEffect } from 'react'

type Transition<S, E> = (state: S, event: E) => S

export type Send<E> = (event: E) => void

type SceneOptions<S extends { status: string }> = {
  minStay?: Partial<Record<S['status'], number>> | number
}

export function createScene<S extends { status: string }, E>(
  transition: Transition<S, E>,
  options?: SceneOptions<S>
) {
  return {
    useScene(initialState: S): [S, Send<E>, () => void] {
      const [state, setState] = useState(initialState)
      const stateRef      = useRef(initialState)
      const initialRef    = useRef(initialState)
      const enteredAt     = useRef(Date.now())
      const timerRef      = useRef<ReturnType<typeof setTimeout>>(undefined)

      useEffect(() => () => { clearTimeout(timerRef.current) }, [])

      const send = useCallback((event: E) => {
        clearTimeout(timerRef.current)

        const current = stateRef.current
        const next    = transition(current, event)
        if (next === current) return

        const minStay = options?.minStay
        const ms      = !minStay ? 0
          : typeof minStay === 'number' ? minStay
          : (minStay as Record<string, number>)[current.status] ?? 0

        const apply = () => {
          stateRef.current  = next
          enteredAt.current = Date.now()
          setState(next)
        }

        const remaining = ms - (Date.now() - enteredAt.current)
        if (remaining <= 0) apply()
        else timerRef.current = setTimeout(apply, remaining)
      }, [])

      const reset = useCallback(() => {
        clearTimeout(timerRef.current)
        stateRef.current  = initialRef.current
        enteredAt.current = Date.now()
        setState(initialRef.current)
      }, [])

      return [state, send, reset]
    },
  }
}
