import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { parseIdE } from './parse'

describe('parseIdE', () => {
  it('parses a positive integer string', () => {
    expect(Effect.runSync(parseIdE('42', 'workspaceId'))).toBe(42)
  })

  it.each(['0', '-3', 'abc', ''])('fails with ValidationFailed for %j', (raw) => {
    const error = Effect.runSync(Effect.flip(parseIdE(raw, 'workspaceId')))
    expect(error._tag).toBe('ValidationFailed')
    expect(error.message).toBe('Invalid workspaceId')
  })
})
