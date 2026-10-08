import {describe, it, expect} from 'vitest'
import {imageSize} from '@/lib/avatars'

describe('imageSize', () => {
  it('reads a PNG header', () => {
    const png = new Uint8Array(24)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    png.set([0, 0, 0x06, 0x40], 16) // 1600
    png.set([0, 0, 0x01, 0x2c], 20) // 300
    expect(imageSize(png)).toEqual({width: 1600, height: 300})
  })

  it('reads a JPEG frame header past other segments', () => {
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00, // APP0, length 4
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x01,
      0x2c,
      0x06,
      0x40, // SOF0 300x1600
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ])
    expect(imageSize(jpeg)).toEqual({width: 1600, height: 300})
  })

  it('gives up on anything else', () => {
    expect(imageSize(new TextEncoder().encode('<svg></svg>'))).toBeNull()
  })
})
