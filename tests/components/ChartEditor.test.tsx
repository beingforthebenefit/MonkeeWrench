import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import ChartEditor from '@/components/ChartEditor'

vi.mock('next/navigation', () => ({
  useRouter: () => ({push: vi.fn(), refresh: vi.fn()}),
}))

const fields = {
  title: 'Sample',
  writer: '',
  leadSinger: '',
  guitars: '',
  length: '',
  keys: '',
  percussion: '',
  youtubeUrl: '',
  lyricsUrl: '',
  status: 'READY' as const,
  notes: '',
}

function editor(demo: boolean) {
  window.fetch = vi.fn(async () => new Response('{}')) as typeof fetch
  render(
    <ChartEditor
      songId="s1"
      initialFields={fields}
      initialSource="[C]Hello"
      baseNumber={1}
      demo={demo}
    />,
  )
  fireEvent.change(screen.getByLabelText('Chart (ChordPro)'), {
    target: {value: '[G]Hello'},
  })
}

describe('ChartEditor', () => {
  afterEach(cleanup)

  it('saves a changed chart', () => {
    editor(false)
    const save = screen.getByRole('button', {name: 'Save'})
    expect(save).not.toBeDisabled()
    fireEvent.click(save)
    expect(window.fetch).toHaveBeenCalledWith(
      '/api/songs/s1/chart',
      expect.objectContaining({method: 'POST'}),
    )
    expect(screen.getByRole('link', {name: /Back to chart/})).toHaveAttribute(
      'href',
      '/songs/s1',
    )
  })

  it('in the tour, edits and previews but never saves', () => {
    editor(true)
    expect(screen.getByText('Hello')).toBeTruthy()
    const save = screen.getByRole('button', {name: 'Save'})
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(window.fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('link', {name: /Back to chart/})).toHaveAttribute(
      'href',
      '/tour/song',
    )
  })
})
