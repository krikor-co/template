'use client'

import { type FormEvent } from 'react'
import { Paperclip, Settings2, Mic, ArrowUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconChip } from './IconChip'
import { useAskAi } from './useAskAi'

/**
 * AskAi — the "Ask AI" assistant input bar.
 *
 * A solid accent slab carrying the ✨ AI signature, a free-text question input,
 * quiet attach / settings affordances, a mic handoff, and the cool-accent `ai`
 * send button. The cool accent (`info`) is reserved for intelligence — this is
 * one of the few primitives allowed to wear it.
 *
 * The optional focus glow lights an `info` ring ONLY while the bar
 * is active (`focus-within`) — never a static, always-on halo. It is gated by
 * `motion-reduce` so the transition no-ops under reduced motion.
 *
 * Controlled or uncontrolled: pass `value` + `onChange` to control the text,
 * else it keeps its own local value. `onSubmit(question)` fires on Enter or the
 * send button; the field clears afterwards in the uncontrolled path.
 * All microcopy (placeholder + affordance labels) is prop-overridable for i18n.
 */
export function AskAi({
  value,
  onChange,
  onSubmit,
  onMic,
  onAttach,
  onSettings,
  placeholder = 'Ask AI…',
  attachLabel = 'Attach',
  settingsLabel = 'Settings',
  micLabel = 'Talk to the AI',
  sendLabel = 'Send question',
  disabled,
  glow = true,
  className,
}: {
  /** Controlled text value. Omit for uncontrolled (local state). */
  value?: string
  onChange?: (next: string) => void
  /** Fires with the trimmed question on submit. */
  onSubmit?: (question: string) => void
  /** Mic affordance — hands off to a `VoiceInput`. Hidden if omitted. */
  onMic?: () => void
  onAttach?: () => void
  onSettings?: () => void
  placeholder?: string
  /** Aria label for the attach affordance. */
  attachLabel?: string
  /** Aria label for the settings affordance. */
  settingsLabel?: string
  /** Aria label for the mic affordance. */
  micLabel?: string
  /** Aria label for the send button. */
  sendLabel?: string
  disabled?: boolean
  /** Light the `info` focus ring while active (default true). */
  glow?: boolean
  className?: string
}) {
  const { text, setText, clear } = useAskAi(value, onChange)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = text.trim()
    if (!q || disabled) return
    onSubmit?.(q)
    clear()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex items-center gap-2 rounded-full bg-accent p-2 pl-3 text-accent-foreground shadow-card',
        'ring-1 ring-inset ring-accent-foreground/15 transition-shadow duration-150',
        glow &&
          'focus-within:shadow-[0_0_0_1px_hsl(var(--info)/0.15),0_8px_30px_-12px_hsl(var(--info)/0.25)] motion-reduce:transition-none',
        disabled && 'opacity-60',
        className,
      )}
    >
      <IconChip tone="info" size="sm">
        <Sparkles aria-hidden />
      </IconChip>

      <input
        type="text"
        name="askAi"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-sm text-accent-foreground placeholder:text-current/55',
          'outline-none disabled:cursor-not-allowed',
        )}
      />

      {onAttach && (
        <AffordanceButton label={attachLabel} onClick={onAttach} disabled={disabled}>
          <Paperclip />
        </AffordanceButton>
      )}
      {onSettings && (
        <AffordanceButton label={settingsLabel} onClick={onSettings} disabled={disabled}>
          <Settings2 />
        </AffordanceButton>
      )}
      {onMic && (
        <AffordanceButton label={micLabel} onClick={onMic} disabled={disabled}>
          <Mic />
        </AffordanceButton>
      )}

      <button
        type="submit"
        aria-label={sendLabel}
        disabled={disabled || text.trim().length === 0}
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
          'bg-info text-info-foreground shadow-sm transition-[opacity,transform] duration-150 ease-out',
          'hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-accent',
          'disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none [&_svg]:size-4',
        )}
      >
        <ArrowUp />
      </button>
    </form>
  )
}

function AffordanceButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-current/70',
        'transition-colors duration-150 hover:bg-accent-foreground/10 hover:text-current',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
        'focus-visible:ring-offset-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
      )}
    >
      {children}
    </button>
  )
}
