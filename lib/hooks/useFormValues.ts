'use client'

import { useState, useCallback, useRef } from 'react'

type Validator = (value: string) => string | null
type CrossFieldValidator = (values: Record<string, string>) => Record<string, string> | null

interface UseFormValuesOptions {
  validate?: CrossFieldValidator
}

interface FieldOptions {
  validate?: Validator
}

export function useFormValues(options?: UseFormValuesOptions) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const validators = useRef<Record<string, Validator>>({})

  const capture = useCallback(
    (formData: FormData): boolean => {
      const next: Record<string, string> = {}
      formData.forEach((v, k) => {
        if (typeof v === 'string') next[k] = v
      })
      setValues(next)

      // Run per-field validators
      const fieldErrors: Record<string, string> = {}
      for (const [name, validate] of Object.entries(validators.current)) {
        const error = validate(next[name] ?? '')
        if (error) fieldErrors[name] = error
      }

      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors)
        return false
      }

      // Run cross-field validator
      if (options?.validate) {
        const crossErrors = options.validate(next)
        if (crossErrors && Object.keys(crossErrors).length) {
          setErrors(crossErrors)
          return false
        }
      }

      setErrors({})
      return true
    },
    [options?.validate],
  )

  const field = useCallback(
    (name: string, fieldOptions?: FieldOptions) => {
      if (fieldOptions?.validate) {
        validators.current[name] = fieldOptions.validate
      }

      return {
        name,
        defaultValue: values[name],
        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
          const validate = validators.current[name]
          if (!validate) return
          const error = validate(e.target.value)
          if (error) {
            setErrors((prev) => ({ ...prev, [name]: error }))
          } else {
            setErrors((prev) => {
              const { [name]: _, ...rest } = prev
              return rest
            })
          }
        },
        onChange: () => {
          if (errors[name]) {
            setErrors((prev) => {
              const { [name]: _, ...rest } = prev
              return rest
            })
          }
        },
      }
    },
    [values, errors],
  )

  return {
    values,
    errors,
    capture,
    setErrors,
    field,
  }
}
