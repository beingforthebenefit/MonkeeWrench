import {describe, it, expect} from 'vitest'
import {mapsUrl} from '@/components/MapLink'

const place = 'Soundwave Studios, 2200 Wood St, Oakland'

describe('mapsUrl', () => {
  it('uses Apple Maps on iPhone and iPad (including iPadOS posing as a Mac)', () => {
    expect(
      mapsUrl(place, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'),
    ).toMatch(/^https:\/\/maps\.apple\.com\/\?q=Soundwave/)
    expect(
      mapsUrl(place, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', true),
    ).toMatch(/^https:\/\/maps\.apple\.com/)
  })

  it('uses Google Maps on Android and desktop', () => {
    expect(mapsUrl(place, 'Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Soundwave/,
    )
    expect(
      mapsUrl(place, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),
    ).toMatch(/google\.com\/maps/)
    expect(mapsUrl(place, 'Mozilla/5.0 (X11; Linux x86_64)')).toMatch(
      /google\.com\/maps/,
    )
  })
})
