// @vitest-environment node
import {describe, it, expect} from 'vitest'
import {renderAbcSvgs} from '@/lib/abc-svg'
import {renderChartsPdf} from '@/lib/pdf'
import {parseChordPro} from '@/lib/chordpro'

describe('notation in PDFs', () => {
  it('draws ABC to SVG off the main thread, transposed', async () => {
    const [up, bad] = await renderAbcSvgs([
      {abc: 'X:1\nL:1/8\nK:C\n"C"C2 E2 G4 |]', steps: 2},
      {abc: '', steps: 0},
    ])
    expect(up?.svg).toMatch(/^<svg/)
    // C went up a tone: the chord symbol reads D
    expect(up?.svg).toMatch(/>D</)
    expect(up?.width).toBeGreaterThan(0)
    expect(bad === null || typeof bad.svg === 'string').toBe(true)
    // The server's own globals stay clean
    expect(typeof (globalThis as {window?: unknown}).window).toBe('undefined')
  })

  it('puts a notation section into the chart PDF', async () => {
    const chart = parseChordPro(
      '{start_of_abc: Riff}\nK:G\n"G"G2 B2 d4 |]\n{end_of_abc}\n{start_of_verse}\n[G]la\n{end_of_verse}',
    )
    const buf = await renderChartsPdf([
      {title: 'T', subtitle: '', chart, footer: 'f'},
    ])
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(2000)
  })
})
