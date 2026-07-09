'use client'

/**
 * Downscale + re-encode an image entirely in the browser BEFORE uploading, so
 * avatar uploads stay tiny (~tens of KB) and never trip the Next.js Server-Action
 * 1 MB body limit — a 48px avatar never needs a multi-MB phone photo. EXIF-
 * orientation-aware (`imageOrientation: 'from-image'`), so portrait photos don't
 * land sideways. FAILS SAFE: any decode/encode issue (or an old browser without
 * `createImageBitmap`) returns the ORIGINAL file unchanged, so the upload still
 * happens (the raised body limit is the backstop there).
 */
export async function downscaleImage(file: File, maxDim = 512, quality = 0.85): Promise<File> {
  // Not worth it (or not possible) for non-rasters / already-tiny files.
  if (!file.type.startsWith('image/') || file.size < 200 * 1024) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality))
    if (!blob || blob.size === 0) return file
    // If re-encoding somehow grew the file, keep the smaller original.
    if (blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'avatar'
    return new File([blob], `${base}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}
