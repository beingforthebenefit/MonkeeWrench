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

/**
 * Browser only. A home-screen icon: the whole image (never cropped), scaled
 * to `scale` of a `size` square and centred on `background`. Phones put
 * transparent icons on black, so a logo with no background gets one here.
 */
export async function squareIcon(
  file: Blob,
  {
    size = 512,
    background = '#f2b134',
    scale = 0.74,
  }: {size?: number; background?: string | null; scale?: number} = {},
) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, size, size)
    }
    ctx.imageSmoothingQuality = 'high'
    const box = size * scale
    const k = Math.min(box / img.naturalWidth, box / img.naturalHeight)
    const w = img.naturalWidth * k
    const h = img.naturalHeight * k
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode'))),
        'image/png',
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Browser only. A picture for a cue: no wider than `max` pixels. A PNG (a
 * screenshot of sheet music) stays PNG so the notes stay crisp; a photo
 * becomes a JPEG.
 */
export async function fitImage(file: Blob, max = 1600) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const k = Math.min(1, max / img.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    const png = file.type === 'image/png'
    if (!png) {
      // JPEG has no transparency: put it on white, like paper
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode'))),
        png ? 'image/png' : 'image/jpeg',
        0.88,
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
