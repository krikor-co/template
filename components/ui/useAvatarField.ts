'use client'

import { useRef, useState } from 'react'
import { downscaleImage } from './downscale-image'

/** Hard client ceiling for the (post-downscale / fallback-original) upload — kept
 *  under the raised Server-Action body limit (next.config.ts bodySizeLimit '8mb')
 *  so an over-cap file errors cleanly instead of 413-ing the request. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/** Flat result every avatar action returns (the shape an avatar-persisting
 *  server action returns — mirror of lib/blob/upload-image.ts's result). */
export type AvatarActionResult =
  | { success: true; url?: string }
  | { success: false; error?: string }

/** A server action that persists the picked `file` and returns its stored URL. */
export type AvatarAction = (formData: FormData) => Promise<AvatarActionResult>

/** A server action that clears the avatar (back to the initials chip). */
export type AvatarRemove = () => Promise<{ success: boolean }>

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'error'; message: string }

type Params = {
  /** Already-stored avatar URL to seed the preview. */
  initialUrl?: string | null
  /** Persists the picked file immediately; returns the new URL. */
  action: AvatarAction
  /** Optional — clears the avatar. When omitted, no "Remove" button shows. */
  onRemove?: AvatarRemove
  /** Fallback copy when an action resolves `success:false` without a message. */
  fallbackError: string
  /** Copy shown when the picked file is too large to upload. */
  tooLargeError: string
}

/**
 * State + actions for `<AvatarField>`. Keeps all hooks out of the component
 * (Flow invariant). Holds the current URL (preview), an upload status, and the
 * file-input ref used to open the native picker and reset it after each pick.
 *
 * Unlike `useImageUpload`, the passed `action` PERSISTS on the server in the
 * same call — so there is no hidden form input or host-form submit; the preview
 * is the source of truth and updates the moment the action resolves.
 */
export function useAvatarField({ initialUrl, action, onRemove, fallbackError, tooLargeError }: Params) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  function pick() {
    inputRef.current?.click()
  }

  /** Always reset the native input so re-picking the same file fires `change`. */
  function resetInput() {
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(file: File) {
    setStatus({ kind: 'uploading' })
    try {
      // Shrink in the browser first → a tiny body that sails under the Server-
      // Action limit (fails safe to the original file on any error).
      const upload = await downscaleImage(file)
      if (upload.size > MAX_UPLOAD_BYTES) {
        resetInput()
        setStatus({ kind: 'error', message: tooLargeError })
        return
      }
      const fd = new FormData()
      fd.append('file', upload)
      const result = await action(fd)
      resetInput()
      if (result.success) {
        if (result.url) setUrl(result.url)
        setStatus({ kind: 'idle' })
      } else {
        setStatus({ kind: 'error', message: result.error || fallbackError })
      }
    } catch {
      // A rejected action (e.g. an over-limit body or network drop) must NOT
      // leave the control stuck on "uploading" forever.
      resetInput()
      setStatus({ kind: 'error', message: fallbackError })
    }
  }

  async function remove() {
    if (!onRemove) return
    setStatus({ kind: 'uploading' })
    try {
      const result = await onRemove()
      if (result.success) {
        setUrl(null)
        setStatus({ kind: 'idle' })
      } else {
        setStatus({ kind: 'error', message: fallbackError })
      }
    } catch {
      setStatus({ kind: 'error', message: fallbackError })
    }
  }

  return { inputRef, url, status, pick, handleFile, remove, canRemove: Boolean(onRemove) }
}
