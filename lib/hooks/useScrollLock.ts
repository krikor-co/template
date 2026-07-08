'use client'

import { useEffect } from 'react'

/**
 * Locks body scroll while an overlay (modal / drawer / lightbox / command
 * palette) is open, so the page underneath can't scroll behind it.
 *
 * REF-COUNTED at the module level: stacked overlays (e.g. a drawer that opens a
 * modal) each call `useScrollLock(true)`; the body is locked once on the first
 * lock and only restored when the LAST lock releases. This prevents an inner
 * overlay closing from prematurely unlocking the page while an outer one is
 * still open.
 *
 * Mirrors the original drawer pattern: `overflow: hidden` plus a `padding-right`
 * that compensates for the disappearing scrollbar, so the layout doesn't shift
 * sideways on viewports with a fixed scrollbar gutter (Linux/Windows mostly).
 */
let lockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

function applyLock() {
  if (typeof document === 'undefined') return
  // Snapshot the pre-lock inline styles so the LAST release restores exactly
  // what was there before the first lock.
  savedOverflow = document.body.style.overflow
  savedPaddingRight = document.body.style.paddingRight
  const sbWidth = window.innerWidth - document.documentElement.clientWidth
  document.body.style.overflow = 'hidden'
  if (sbWidth > 0) document.body.style.paddingRight = `${sbWidth}px`
}

function releaseLock() {
  if (typeof document === 'undefined') return
  document.body.style.overflow = savedOverflow
  document.body.style.paddingRight = savedPaddingRight
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (lockCount === 0) applyLock()
    lockCount += 1
    return () => {
      lockCount -= 1
      if (lockCount === 0) releaseLock()
    }
  }, [active])
}
