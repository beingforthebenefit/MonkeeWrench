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

  it('writes every section out, with its label and note', () => {
    const chart = parseChordPro(
      '{start_of_chorus: Chorus}\n[C]la\n{end_of_chorus}\n{chorus: Chorus (x2)}\n',
    )
    const {container, getAllByText} = render(<ChartBody chart={chart} />)
    expect(getAllByText('Chorus')).toHaveLength(2)
    expect(container.querySelectorAll('.chart-chord')).toHaveLength(2)
  })

  it('renders tablature verbatim', () => {
    const chart = parseChordPro('{start_of_tab}\ne|---0---|\n{end_of_tab}\n')
    const {container} = render(<ChartBody chart={chart} />)
    expect(container.querySelector('.chart-tab')?.textContent).toBe(
      'e|---0---|',
    )
  })
})
