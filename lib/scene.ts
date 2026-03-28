import { useReducer } from 'react'

type Transition<S, E> = (state: S, event: E) => S

export type Send<E> = (event: E) => void

export function createScene<S, E>(transition: Transition<S, E>) {
  return {
    useScene(initialState: S): [S, Send<E>] {
      return useReducer(transition, initialState)
    },
  }
}
