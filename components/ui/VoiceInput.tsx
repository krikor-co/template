'use client'

import { useReducedMotion } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * VoiceInput — the mic + waveform voice-intake widget.
 *
 * A round mic button beside a row of waveform bars. While `listening`, the bars
 * animate in a gentle, staggered breathing wave; idle shows a static mic and
 * flat bars. The cool accent (`info`) marks the *active* listening state — one
 * of the few primitives allowed to wear it.
 *
 * Reduced-motion safe two ways: the animation only mounts when the user has NOT
 * requested reduced motion (via `useReducedMotion`), and the keyframes
 * themselves are wrapped so any stray application no-ops under
 * `prefers-reduced-motion`. When reduced, listening shows a steady (un-animated)
 * info wave so the state is still legible without movement.
 *
 * Presentational: `listening` + `onToggle` are owned by the caller. SSR-safe —
 * bar heights are deterministic. All microcopy is prop-overridable for i18n.
 */

// Deterministic bar heights (% of track) — a calm, symmetric envelope.
const BARS = [38, 62, 88, 54, 100, 46, 78, 60, 34]

export function VoiceInput({
  listening,
  onToggle,
  label,
  listeningLabel = 'Listening…',
  idleLabel = 'Microphone off',
  bars = BARS,
  className,
}: {
  listening: boolean
  onToggle: () => void
  /** Accessible label for the mic toggle (defaults by state). */
  label?: string
  /** Aria label for the waveform while listening. */
  listeningLabel?: string
  /** Aria label for the waveform while idle. */
  idleLabel?: string
  /** Override the waveform bar envelope (heights 0–100). */
  bars?: number[]
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const animate = listening && !reduceMotion
  const micLabel = label ?? (listening ? 'Stop listening' : 'Talk to the AI')

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-full bg-accent p-2 pl-2 pr-4 text-accent-foreground shadow-card',
        'ring-1 ring-inset ring-accent-foreground/15',
        className,
      )}
    >
      <button
        type="button"
        aria-label={micLabel}
        aria-pressed={listening}
        onClick={onToggle}
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
          'transition-[background-color,color,opacity] duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-accent active:scale-[0.96]',
          'motion-reduce:transition-none [&_svg]:size-5',
          listening
            ? 'bg-info text-info-foreground'
            : 'bg-accent-foreground/10 text-current/80 hover:text-current',
        )}
      >
        {listening ? <Mic /> : <MicOff />}
      </button>

      <div
        role="img"
        aria-label={listening ? listeningLabel : idleLabel}
        className="flex h-8 flex-1 items-center justify-center gap-1"
      >
        {bars.map((h, i) => (
          <span
            key={i}
            className={cn(
              'w-1 shrink-0 rounded-full transition-[height,background-color] duration-200 ease-out',
              listening ? 'bg-info' : 'bg-accent-foreground/20',
              animate && 'voiceinput-bar motion-reduce:!animate-none',
            )}
            style={{
              height: `${listening ? h : 16}%`,
              animationDelay: `${i * 90}ms`,
            }}
          />
        ))}
      </div>

      {/* Scoped, self-contained waveform keyframes — reduced-motion gated. */}
      <style>{`
        @keyframes voiceinput-wave {
          0%, 100% { transform: scaleY(0.4); }
          50%      { transform: scaleY(1); }
        }
        .voiceinput-bar {
          transform-origin: center;
          animation: voiceinput-wave 1s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .voiceinput-bar { animation: none; transform: none; }
        }
      `}</style>
    </div>
  )
}
