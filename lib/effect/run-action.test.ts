import { describe, expect, it } from 'vitest'
import './test-env'
import { Effect } from 'effect'
import { runAction } from './run-action'
import { ConflictError, NotFound, ValidationFailed } from './errors'

describe('runAction error mapping', () => {
  it('flattens success data into the envelope', async () => {
    const result = await runAction(Effect.succeed({ id: 7 }))
    expect(result).toEqual({ success: true, id: 7 })
  })

  it('maps a typed failure to { success: false, kind, error }', async () => {
    const result = await runAction(Effect.fail(new NotFound({ entity: 'person', id: 1 })))
    expect(result).toEqual({ success: false, kind: 'NotFound', error: 'person not found' })
  })

  it('copies ValidationFailed fieldErrors onto the boundary result', async () => {
    const result = await runAction(Effect.fail(new ValidationFailed({
      message:     'Name is required',
      fieldErrors: { name: ['Name is required'] },
    })))
    expect(result).toEqual({
      success:     false,
      kind:        'ValidationFailed',
      error:       'Name is required',
      fieldErrors: { name: ['Name is required'] },
    })
  })

  it("uses the class tag 'Conflict' for ConflictError", async () => {
    const result = await runAction(Effect.fail(new ConflictError({ message: 'already settled' })))
    expect(result).toMatchObject({ success: false, kind: 'Conflict', error: 'already settled' })
  })

  it('maps defects (raw throws) to a generic DbError result', async () => {
    const result = await runAction(Effect.sync(() => { throw new Error('boom') }))
    expect(result).toEqual({ success: false, kind: 'DbError', error: 'Unexpected server error' })
  })

  it('fires the boundary timeout as a typed Timeout failure', async () => {
    const never = Effect.promise(() => new Promise<{ ok: boolean }>(() => {}))
    const result = await runAction(never, { timeout: '20 millis' })
    expect(result).toMatchObject({ success: false, kind: 'Timeout' })
  })
})
