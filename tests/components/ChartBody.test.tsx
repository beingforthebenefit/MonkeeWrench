import React from 'react'
import {describe, it, expect} from 'vitest'
import {render} from '@testing-library/react'
import ChartBody from '@/components/chart/ChartBody'
import {parseChordPro} from '@/lib/chordpro'

describe('ChartBody', () => {
  it('keeps the pieces of one word together so lines only wrap between words', () => {
    const chart = parseChordPro(
      '{start_of_verse: V}\nA home[Em]coming [A7]queen\n{end_of_verse}\n',
    )
    const {container} = render(<ChartBody chart={chart} />)
    const words = Array.from(container.querySelectorAll('.chart-word')).map(
      (w) => w.textContent,
    )
    expect(words).toEqual(['A ', 'homeEmcoming ', 'A7queen'])
  })

  it('keeps chords after the last word with that word', () => {
    const chart = parseChordPro(
      '{start_of_verse: V}\nWould never [A7]ring   [D7]\n{end_of_verse}\n',
    )
    const {container} = render(<ChartBody chart={chart} />)
    const words = Array.from(container.querySelectorAll('.chart-word')).map(
      (w) => w.textContent,
    )
    expect(words[words.length - 1]).toBe('A7ring   D7')
  })

  it('writes every section out, with its label and note', () => {
    const chart = parseChordPro(
      '{start_of_chorus: Chorus}\n[C]la\n{end_of_chorus}\n{chorus: Chorus (x2)}\n',
    )
    const {container, getAllByText} = render(<ChartBody chart={chart} />)
    expect(getAllByText('Chorus')).toHaveLength(2)
    expect(container.querySelectorAll('.chart-chord')).toHaveLength(2)
  })

  it('puts consecutive tab lines in one scroll block, so they move together', () => {
    const chart = parseChordPro(
      '{start_of_tab}\ne|---0---|\nB|---1---|\nG|---0---|\n{end_of_tab}\n',
    )
    const {container} = render(<ChartBody chart={chart} />)
    const blocks = container.querySelectorAll('.chart-tab-block')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].querySelectorAll('.chart-tab')).toHaveLength(3)
    expect(blocks[0].hasAttribute('data-hscroll')).toBe(true)
  })

  it('renders tablature verbatim', () => {
    const chart = parseChordPro('{start_of_tab}\ne|---0---|\n{end_of_tab}\n')
    const {container} = render(<ChartBody chart={chart} />)
    expect(container.querySelector('.chart-tab')?.textContent).toBe(
      'e|---0---|',
    )
  })

  it('keeps a section heading with its first line, so a column never ends on a bare label', () => {
    const chart = parseChordPro(
      '{start_of_chorus: Chorus}\n[C]one\n[G]two\n{end_of_chorus}\n',
    )
    const {container} = render(<ChartBody chart={chart} />)
    const keep = container.querySelector('.chart-keep')!
    expect(keep.querySelector('h3')?.textContent).toBe('Chorus')
    expect(keep.querySelectorAll('.chart-line')).toHaveLength(1)
    expect(container.querySelectorAll('.chart-line')).toHaveLength(2)
  })
})
