'use client'

import { OTPInput, type SlotProps } from 'input-otp'
import { cn } from '@/lib/utils'

/**
 * Segmented 6-digit OTP field built on the headless `input-otp` library.
 *
 * One real hidden <input> drives a row of styled slots, so the digit-to-box
 * mapping can never desync. Numeric-only, OS one-time-code autofill, paste of a
 * full code fills every box, typing auto-advances, Backspace steps back, and the
 * active slot shows a focus ring + blinking caret. No single-input overlay,
 * so the browser key/passkey icon never crowds the digits.
 */
export function OtpInput({
  name,
  id,
  length = 6,
  autoFocus,
  disabled,
  defaultValue,
  hasError,
  onChange,
}: {
  name: string
  id?: string
  length?: number
  autoFocus?: boolean
  disabled?: boolean
  defaultValue?: string
  hasError?: boolean
  onChange?: (value: string) => void
}) {
  return (
    <OTPInput
      id={id}
      name={name}
      maxLength={length}
      autoFocus={autoFocus}
      disabled={disabled}
      defaultValue={defaultValue}
      onChange={onChange}
      inputMode="numeric"
      pattern="\d*"
      autoComplete="one-time-code"
      containerClassName={cn('flex w-full items-center gap-2', disabled && 'opacity-60')}
      render={({ slots }) => (
        <>
          {slots.map((slot, i) => (
            <OtpSlot key={i} {...slot} hasError={hasError} />
          ))}
        </>
      )}
    />
  )
}

function OtpSlot({ char, isActive, hasError }: SlotProps & { hasError?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex h-14 flex-1 items-center justify-center rounded-xl border bg-card text-3xl font-semibold tabular-nums text-foreground shadow-sm transition-all',
        hasError
          ? 'border-destructive/40'
          : isActive
            ? 'border-ring ring-2 ring-ring/40 z-10'
            : 'border-input',
      )}
    >
      {char !== null && <span>{char}</span>}
      {isActive && char === null && <FakeCaret />}
    </div>
  )
}

function FakeCaret() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {/* .otp-caret (app/globals.css) blinks this bar; without the keyframe it renders steady */}
      <div className="otp-caret h-7 w-px bg-foreground" />
    </div>
  )
}
