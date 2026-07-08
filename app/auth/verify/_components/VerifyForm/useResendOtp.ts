'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { resendOtpAction } from './actions'
import type { IdentifierType } from '@/lib/auth/identifier'

type ResendStatus = 'waiting' | 'ready' | 'sending' | 'sent' | 'error'

export function useResendOtp(identifier: string, identifierType: IdentifierType, cooldownSeconds = 30) {
  const [status, setStatus] = useState<ResendStatus>('waiting')
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const sentTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // The post-"sent" reset fires 2s later; clear it on unmount so a user who
  // verifies and navigates away inside that window doesn't trigger a
  // setState on an unmounted component (React warning + leaked timer).
  useEffect(() => () => clearTimeout(sentTimeoutRef.current), [])

  // Countdown timer — decrements secondsLeft every second
  useEffect(() => {
    if (status !== 'waiting') return

    setSecondsLeft((prev) => (prev <= 0 ? cooldownSeconds : prev))

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [status, cooldownSeconds])

  // Transition to 'ready' when countdown reaches 0
  useEffect(() => {
    if (status === 'waiting' && secondsLeft === 0) {
      setStatus('ready')
    }
  }, [status, secondsLeft])

  const resend = useCallback(async () => {
    setStatus('sending')
    setError(null)
    const result = await resendOtpAction(identifier, identifierType)
    if (result.success) {
      setStatus('sent')
      sentTimeoutRef.current = setTimeout(() => {
        setSecondsLeft(cooldownSeconds)
        setStatus('waiting')
      }, 2000)
    } else {
      setError(result.error)
      setStatus('error')
    }
  }, [identifier, identifierType, cooldownSeconds])

  return { status, secondsLeft, error, resend }
}
