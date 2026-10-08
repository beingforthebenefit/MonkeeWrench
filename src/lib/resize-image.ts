import {AVATAR_SIZE} from './avatars'

/**
 * Browser only. Crops the middle square out of a photo and scales it to
 * AVATAR_SIZE, as a JPEG: a 12 MP phone photo becomes ~20 KB. Drawing
 * through an <img> applies the photo's EXIF rotation, and iOS hands HEIC
 * photos to file inputs as JPEG, so any photo from a phone works.
 */
export async function squareJpeg(file: Blob, size = AVATAR_SIZE) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    )
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode'))),
        'image/jpeg',
        0.85,
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
