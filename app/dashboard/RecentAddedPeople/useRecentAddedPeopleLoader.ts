import { useEffect } from 'react'
import type { State, Event } from './state'
import type { Send } from '@/lib/scene'
import { loadData } from './actions'

export function useRecentAddedPeopleLoader(state: State, send: Send<Event>) {
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
