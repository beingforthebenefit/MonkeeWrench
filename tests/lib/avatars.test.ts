import {describe, it, expect} from 'vitest'
import {avatarUrl, sniffImage} from '@/lib/avatars'

describe('avatars', () => {
  it('versions the URL by upload time, and has none without a photo', () => {
    expect(avatarUrl({id: 'u1', avatarAt: new Date(1000)})).toBe(
      '/api/avatars/u1?v=1000',
    )
    expect(avatarUrl({id: 'u1', avatarAt: null})).toBeNull()
  })

  it('tells JPEG, PNG and WebP from their first bytes, and nothing else', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    )
    expect(
      sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])),
    ).toBe('image/png')
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')
    expect(sniffImage(webp)).toBe('image/webp')
    expect(sniffImage(new TextEncoder().encode('<svg onload=x>'))).toBeNull()
    expect(sniffImage(new Uint8Array([]))).toBeNull()
  })
})
