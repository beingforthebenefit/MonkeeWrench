/** Uploads are resized in the browser to this square, in pixels */
export const AVATAR_SIZE = 256

/** Far above a 256px JPEG (~20 KB); rejects anything that skipped resizing */
export const AVATAR_MAX_BYTES = 300_000

/**
 * The photo's URL, or null when there is none. The ?v= changes with every
 * upload, so the image can be cached forever without going stale.
 */
export function avatarUrl(u: {id: string; avatarAt: Date | null}) {
  return u.avatarAt ? `/api/avatars/${u.id}?v=${u.avatarAt.getTime()}` : null
}

/** The image type from the file's first bytes (never trust Content-Type). */
export function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return 'image/png'
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...b.slice(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}
