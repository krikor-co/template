'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { resendOtpAction } from './actions'

type ResendStatus = 'waiting' | 'ready' | 'sending' | 'sent' | 'error'

export function useResendOtp(email: string, cooldownSeconds = 30) {
  const [status, setStatus] = useState<ResendStatus>('waiting')
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

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
    const result = await resendOtpAction(email)
    if (result.success) {
      setStatus('sent')
      setTimeout(() => {
        setSecondsLeft(cooldownSeconds)
        setStatus('waiting')
      }, 2000)
    } else {
      setError(result.error)
      setStatus('error')
    }
  }, [email, cooldownSeconds])

  return { status, secondsLeft, error, resend }
}
