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
    useScene(initialState: S): [S, Send<E>] {
      const [, forceRender] = useState(0)
      const state     = useRef(initialState)
      const enteredAt = useRef(Date.now())

      const send = useCallback((event: E) => {
        const current = state.current
        const next    = transition(current, event)
        if (next === current) return

        const minStay = options?.minStay
        const ms      = !minStay ? 0
          : typeof minStay === 'number' ? minStay
          : (minStay as Record<string, number>)[current.status] ?? 0

        const apply = () => {
          state.current     = next
          enteredAt.current = Date.now()
          forceRender(n => n + 1)
        }

        const remaining = ms - (Date.now() - enteredAt.current)
        if (remaining <= 0) apply()
        else setTimeout(apply, remaining)
      }, [])

      return [state.current, send]
    },
  }
}
