import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import ChartScreen from '@/components/ChartScreen'
import {DEMO_SONG} from '@/lib/tour-demo'

vi.mock('next/navigation', () => ({
  useRouter: () => ({push: vi.fn(), refresh: vi.fn()}),
  usePathname: () => '/songs/s1',
}))

const props = {
  song: DEMO_SONG,
  editedBy: null,
  editedAt: null,
}

describe('ChartScreen', () => {
  afterEach(cleanup)

  it('links to the history of a song with versions', () => {
    render(<ChartScreen {...props} source="[C]Hi" version={2} versions={2} />)
    expect(
      screen.getByRole('link', {name: /History · 2 versions/}),
    ).toHaveAttribute('href', `/songs/${DEMO_SONG.id}/history`)
  })

  it('has no history link before the song has a chart', () => {
    render(<ChartScreen {...props} source="" version={0} versions={0} />)
    expect(screen.queryByRole('link', {name: /History/})).toBeNull()
  })
})
