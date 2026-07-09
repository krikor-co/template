'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type RevealProps = {
  children: ReactNode
  /** Explicit delay (seconds). Takes precedence over `index`. */
  delay?: number
  /** Stagger position — multiplied by ~0.05s to derive a gentle delay. */
  index?: number
  className?: string
  /** Render as a different element via framer-motion's `as` is not used; wrap with a div. */
  as?: 'div' | 'section'
}

const STAGGER_STEP = 0.05
const MAX_STAGGER_DELAY = 0.4

/**
 * Reveal — tasteful mount animation primitive.
 *
 * Fades + slides up (~8px, ~0.25s, ease-out) when first rendered. Pass `index`
 * for a gentle staggered cascade across a list of sibling sections, or `delay`
 * for an explicit value.
 *
 * Respects `prefers-reduced-motion`: when reduced, no transform/opacity
 * animation runs — children render statically. SSR-safe (client component;
 * framer-motion renders the initial state on the server, then animates on
 * mount).
 */
export function Reveal({ children, delay, index, className, as = 'div' }: RevealProps) {
  const reduceMotion = useReducedMotion()

  const resolvedDelay =
    delay ?? Math.min((index ?? 0) * STAGGER_STEP, MAX_STAGGER_DELAY)

  const MotionTag = as === 'section' ? motion.section : motion.div

  if (reduceMotion) {
    const Tag = as
    return <Tag className={className}>{children}</Tag>
  }

  return (
    <MotionTag
      className={cn(className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: resolvedDelay }}
    >
      {children}
    </MotionTag>
  )
}
