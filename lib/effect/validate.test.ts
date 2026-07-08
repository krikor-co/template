import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { z } from 'zod'
import { validate } from './validate'
import { ValidationFailed } from './errors'

const Input = z.object({
  name: z.string().min(1, 'Name is required'),
  age:  z.number().int().positive('Age must be positive'),
})

describe('validate', () => {
  it('succeeds with the parsed value', () => {
    const value = Effect.runSync(validate(Input, { name: 'Ada', age: 36 }))
    expect(value).toEqual({ name: 'Ada', age: 36 })
  })

  it('fails with ValidationFailed carrying fieldErrors per field', () => {
    const error = Effect.runSync(Effect.flip(validate(Input, { name: '', age: -1 })))
    expect(error).toBeInstanceOf(ValidationFailed)
    expect(error._tag).toBe('ValidationFailed')
    expect(error.fieldErrors).toEqual({
      name: ['Name is required'],
      age:  ['Age must be positive'],
    })
  })

  it('surfaces the first issue message at the top level', () => {
    const error = Effect.runSync(Effect.flip(validate(Input, { name: '', age: 36 })))
    expect(error.message).toBe('Name is required')
  })
})
