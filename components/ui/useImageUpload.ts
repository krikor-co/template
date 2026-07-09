'use client'

import { useRef, useState } from 'react'
import { uploadImage } from '@/lib/blob/upload-image'

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'error'; message: string }

/** Result shape every uploader server action returns. */
export type ImageUploadResult =
  | { success: true; url: string }
  | { success: false; error: string }

/** A server action that uploads a `file` FormData entry and returns its URL. */
export type ImageUploader = (
  workspaceId: string,
  formData: FormData,
  folder?: string,
) => Promise<ImageUploadResult>

type Params = {
  workspaceId: string
  folder?: string
  /** Seed preview/value with an already-stored URL (edit forms). */
  initialUrl?: string | null
  /** Bubble the resulting URL up to the host form. */
  onChange?: (url: string | null) => void
  /**
   * Override the upload action. Defaults to `uploadImage` (PRIVATE blob,
   * served via the authed /api/blob-image proxy). Apps with a PUBLIC blob
   * store pass their own public-store action so the URL loads
   * unauthenticated (see docs/blob.md "Public assets").
   */
  uploader?: ImageUploader
}

/**
 * State + actions for the `<ImageUpload>` primitive. Keeps all hooks out of the
 * component (Flow invariant). Holds the current URL (preview + hidden-input
 * source of truth), an upload status, and the file-input ref used to trigger
 * the native picker and to reset it after each pick.
 */
export function useImageUpload({ workspaceId, folder, initialUrl, onChange, uploader }: Params) {
  const upload = uploader ?? uploadImage
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  function pick() {
    inputRef.current?.click()
  }

  async function handleFile(file: File) {
    setStatus({ kind: 'uploading' })
    const fd = new FormData()
    fd.append('file', file)
    const result = await upload(workspaceId, fd, folder)
    // Reset the native input so re-picking the same file fires `change` again.
    if (inputRef.current) inputRef.current.value = ''
    if (result.success) {
      setUrl(result.url)
      setStatus({ kind: 'idle' })
      onChange?.(result.url)
    } else {
      setStatus({ kind: 'error', message: result.error })
    }
  }

  function remove() {
    setUrl(null)
    setStatus({ kind: 'idle' })
    onChange?.(null)
  }

  return { inputRef, url, status, pick, handleFile, remove }
}
