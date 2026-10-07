import {describe, it, expect} from 'vitest'
import {chartDiff} from '@/lib/chart-diff'

const v1 = `{start_of_chorus: Chorus}
[C]Sing it [D]once
[C]Sing it [D]twice
{end_of_chorus}
`

describe('chartDiff', () => {
  it('shows a moved chord as a removed and an added chord line', () => {
    const v2 = v1.replace('[C]Sing it [D]twice', 'Sing [C]it [D]twice')
    const rows = chartDiff(v1, v2)
    expect(rows.filter((r) => r.kind === 'removed').map((r) => r.text)).toEqual(
      ['C       D'],
    )
    expect(rows.filter((r) => r.kind === 'added').map((r) => r.text)).toEqual([
      '     C  D',
    ])
  })

  it('is empty when nothing changed', () => {
    expect(chartDiff(v1, v1)).toEqual([])
  })
})
