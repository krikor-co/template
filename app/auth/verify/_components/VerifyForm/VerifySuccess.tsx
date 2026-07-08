'use client'

import { motion } from 'framer-motion'
import { useVerifySuccess } from './useVerifySuccess'

/**
 * Auth-success scene: a spring-scaled primary disc with a drawn-in
 * checkmark, a success burst ring, success copy and a subtle redirecting
 * affordance. Shown for the scene's success hold before the redirect fires.
 * Reduced-motion aware — every entrance collapses to a static render.
 */
export function VerifySuccess({ title, hint }: { title: string; hint: string }) {
  const { reduce } = useVerifySuccess()

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* burst ring */}
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-primary/30"
            initial={{ scale: 0.6, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        )}

        {/* disc */}
        <motion.div
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        >
          <svg
            viewBox="0 0 52 52"
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <motion.path
              d="M14 27 L23 36 L39 18"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.18, duration: 0.4, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        className="space-y-1"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.3 }}
      >
        <p className="text-xl font-semibold text-foreground">{title}</p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {/* .otp-caret (globals.css) blinks the dot; degrades to steady without it */}
          <span className="otp-caret inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          {hint}
        </p>
      </motion.div>
    </div>
  )
}
