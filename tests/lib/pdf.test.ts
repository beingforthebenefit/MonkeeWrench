import {describe, it, expect} from 'vitest'
import {renderChartsPdf} from '@/lib/pdf'
import {buildPdfItem} from '@/lib/chart-pdf'

const SOURCE = `{title: Test Song}
{start_of_intro: Intro}
[G]    [D7sus4]    [G]    [D7sus4]
{end_of_intro}
{start_of_verse: Verse 1}
We walk along [G]the morning [Am]road
And carry [Bm]all the things we [C]owe
{end_of_verse}
{start_of_chorus: Chorus}
[C]Sing it [D]once a[Bm]gain
{end_of_chorus}
{start_of_chorus: Chorus (x2)}
[C]Sing it [D]once a[Bm]gain
{end_of_chorus}
`

const song = {title: 'Test Song', writer: 'Someone', leadSinger: 'Davy'}
const version = {
  number: 4,
  source: SOURCE,
  createdAt: new Date('2026-10-05T20:00:00Z'),
  author: {name: 'Alan Mac', email: 'alan@example.com'},
}

function pageCount(buf: Buffer) {
  return (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length
}

describe('buildPdfItem', () => {
  it('stamps version and editor in the footer', () => {
    const item = buildPdfItem(song, version)
    expect(item.footer).toContain('version 4, edited by Alan on Oct 5, 2026')
    expect(item.subtitle).toContain('Key: G')
  })

  it('transposes to a requested key and says so', () => {
    const item = buildPdfItem(song, version, {key: 'A'})
    expect(item.subtitle).toContain('Key: A (original G)')
  })
})

describe('renderChartsPdf', () => {
  it('renders one page per short song', async () => {
    const items = [buildPdfItem(song, version), buildPdfItem(song, version)]
    const buf = await renderChartsPdf(items)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pageCount(buf)).toBe(2)
  })

  it('supports A4', async () => {
    const buf = await renderChartsPdf([buildPdfItem(song, version)], {
      paper: 'A4',
    })
    expect(buf.toString('latin1')).toContain('595.28')
  })
})
