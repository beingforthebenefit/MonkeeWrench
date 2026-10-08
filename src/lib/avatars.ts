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

/** Width and height from a PNG, JPEG or WebP's own header; null if unreadable. */
export function imageSize(
  b: Uint8Array,
): {width: number; height: number} | null {
  const type = sniffImage(b)
  const u16 = (i: number) => (b[i] << 8) | b[i + 1]
  const u32 = (i: number) =>
    ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
  if (type === 'image/png' && b.length >= 24)
    return {width: u32(16), height: u32(20)}
  if (type === 'image/jpeg') {
    // Walk the segments to the frame header (SOF0..SOF15, not DHT/JPG/DAC)
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      const len = u16(i + 2)
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      )
        return {height: u16(i + 5), width: u16(i + 7)}
      i += 2 + len
    }
    return null
  }
  if (type === 'image/webp' && b.length >= 30) {
    const chunk = String.fromCharCode(...b.slice(12, 16))
    if (chunk === 'VP8X')
      return {
        width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
        height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
      }
    if (chunk === 'VP8 ')
      return {
        width: (b[26] | (b[27] << 8)) & 0x3fff,
        height: (b[28] | (b[29] << 8)) & 0x3fff,
      }
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
      return {width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1}
    }
  }
  return null
}
