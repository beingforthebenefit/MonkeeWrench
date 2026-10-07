import PDFDocument from 'pdfkit'
import type {Chart, ChartLine, Section} from './chordpro'

/**
 * Chart PDFs, generated on request from the stored ChordPro — there is no
 * stored PDF to go stale. Each song starts on a new page and is fitted to one
 * page where possible: two columns if the lines are short enough, shrinking
 * the type down to MIN_SIZE before allowing a page break.
 */

export type PdfItem = {
  title: string
  subtitle: string
  chart: Chart
  /** Printed at the bottom: version and who edited it, so stale printouts are obvious */
  footer: string
  /** Setlist note for this song, printed in a box under the title */
  note?: string | null
}

export type PdfOptions = {paper?: 'LETTER' | 'A4'}

const MARGIN = 40
const MAX_SIZE = 13
const MIN_SIZE = 8
const LYRIC = 'Helvetica'
const CHORD = 'Helvetica-Bold'
const GUTTER = 28

type Doc = InstanceType<typeof PDFDocument>

function hasChords(line: ChartLine) {
  return line.kind === 'lyrics' && line.segments.some((s) => s.chord)
}
function hasWords(line: ChartLine) {
  return line.kind === 'lyrics' && line.segments.some((s) => s.lyric.trim())
}

/** Space after a chord; chord-only lines get more so they read as a count */
function chordGap(line: ChartLine, size: number) {
  return hasWords(line) ? size * 0.5 : size * 1.4
}

function lineHeight(line: ChartLine, size: number) {
  if (line.kind === 'comment') return size * 1.3
  return (hasChords(line) ? size * 1.15 : 0) + (hasWords(line) ? size * 1.3 : 0)
}

function sectionHeight(s: Section, size: number) {
  const label = size * 1.5
  if (s.repeatOf !== null) return label + size * 1.9
  return (
    label + s.lines.reduce((h, l) => h + lineHeight(l, size), 0) + size * 0.6
  )
}

function lineWidth(doc: Doc, line: ChartLine, size: number) {
  if (line.kind === 'comment') {
    doc.font('Helvetica-Oblique').fontSize(size)
    return doc.widthOfString(line.text)
  }
  let w = 0
  for (const seg of line.segments) {
    doc.font(LYRIC).fontSize(size)
    const lw = doc.widthOfString(seg.lyric)
    doc.font(CHORD).fontSize(size)
    const cw = seg.chord
      ? doc.widthOfString(seg.chord) + chordGap(line, size)
      : 0
    w += Math.max(lw, cw)
  }
  return w
}

type Layout = {size: number; columns: 1 | 2; split: number}

/** Find the largest type size that fits the song on one page. */
function fitLayout(
  doc: Doc,
  chart: Chart,
  width: number,
  height: number,
): Layout {
  const sections = chart.sections
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 0.5) {
    const heights = sections.map((s) => sectionHeight(s, size))
    const total = heights.reduce((a, b) => a + b, 0)
    const widest = Math.max(
      0,
      ...sections.flatMap((s) => s.lines.map((l) => lineWidth(doc, l, size))),
    )
    if (total <= height && widest <= width)
      return {size, columns: 1, split: sections.length}
    const colWidth = (width - GUTTER) / 2
    if (widest <= colWidth) {
      // Greedy: fill the first column, put the rest in the second
      let used = 0
      let split = 0
      while (split < sections.length && used + heights[split] <= height)
        used += heights[split++]
      const rest = heights.slice(split).reduce((a, b) => a + b, 0)
      if (rest <= height) return {size, columns: 2, split}
    }
  }
  return {size: 10, columns: 1, split: sections.length}
}

function drawLine(
  doc: Doc,
  line: ChartLine,
  x: number,
  y: number,
  size: number,
) {
  if (line.kind === 'comment') {
    doc.font('Helvetica-Oblique').fontSize(size).fillColor('#444')
    doc.text(line.text, x, y, {lineBreak: false})
    return y + size * 1.3
  }
  const chordRow = hasChords(line)
  const wordRow = hasWords(line)
  const chordY = y
  const wordY = y + (chordRow ? size * 1.15 : 0)
  let cx = x
  for (const seg of line.segments) {
    doc.font(LYRIC).fontSize(size)
    const lw = doc.widthOfString(seg.lyric)
    let cw = 0
    if (seg.chord) {
      doc.font(CHORD).fontSize(size).fillColor('#000')
      cw = doc.widthOfString(seg.chord) + chordGap(line, size)
      doc.text(seg.chord, cx, chordY, {lineBreak: false})
    }
    if (wordRow && seg.lyric) {
      doc.font(LYRIC).fontSize(size).fillColor('#000')
      doc.text(seg.lyric, cx, wordY, {lineBreak: false})
    }
    cx += Math.max(lw, cw)
  }
  return wordY + (wordRow ? size * 1.3 : 0)
}

function drawSection(
  doc: Doc,
  s: Section,
  sections: Section[],
  x: number,
  y: number,
  size: number,
) {
  const label = (s.label || s.type).toUpperCase()
  doc
    .font('Helvetica-Bold')
    .fontSize(size * 0.75)
    .fillColor('#555')
  doc.text(label + (s.note ? `  ·  ${s.note}` : ''), x, y, {
    lineBreak: false,
    characterSpacing: 0.8,
  })
  y += size * 1.5
  // A section identical to an earlier one is printed as a pointer to it
  if (s.repeatOf !== null) {
    const of = sections[s.repeatOf]
    doc.font('Helvetica-Oblique').fontSize(size).fillColor('#444')
    doc.text(`Same as ${of?.label || 'above'}`, x, y, {
      lineBreak: false,
    })
    return y + size * 1.9
  }
  for (const l of s.lines) y = drawLine(doc, l, x, y, size)
  return y + size * 0.6
}

function drawPage(doc: Doc, item: PdfItem) {
  const pageW = doc.page.width
  const pageH = doc.page.height
  const width = pageW - MARGIN * 2
  let y = MARGIN

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#000')
  doc.text(item.title, MARGIN, y, {width})
  y = doc.y + 2
  if (item.subtitle) {
    doc.font(LYRIC).fontSize(10).fillColor('#444')
    doc.text(item.subtitle, MARGIN, y, {width})
    y = doc.y
  }
  if (item.note) {
    y += 8
    doc.font(LYRIC).fontSize(11)
    const h = doc.heightOfString(item.note, {width: width - 16}) + 12
    doc.rect(MARGIN, y, width, h).lineWidth(1).stroke('#000')
    doc
      .fillColor('#000')
      .text(item.note, MARGIN + 8, y + 6, {width: width - 16})
    y += h
  }
  y += 14

  const footerY = pageH - MARGIN + 12
  const bottom = pageH - MARGIN - 6
  const footer = () => {
    // Writing inside the bottom margin would make pdfkit start a new page
    const saved = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font(LYRIC).fontSize(8).fillColor('#555')
    doc.text(item.footer, MARGIN, footerY, {width, lineBreak: false})
    doc.page.margins.bottom = saved
  }

  const layout = fitLayout(doc, item.chart, width, bottom - y)
  const sections = item.chart.sections
  if (layout.columns === 2) {
    const colW = (width - GUTTER) / 2
    let cy = y
    sections.forEach((s, i) => {
      if (i === layout.split) cy = y
      const x = i < layout.split ? MARGIN : MARGIN + colW + GUTTER
      cy = drawSection(doc, s, sections, x, cy, layout.size)
    })
    footer()
    return
  }
  let cy = y
  for (const s of sections) {
    if (cy + sectionHeight(s, layout.size) > bottom && cy > y) {
      footer()
      doc.addPage()
      cy = MARGIN
    }
    cy = drawSection(doc, s, sections, MARGIN, cy, layout.size)
  }
  footer()
}

export function renderChartsPdf(
  items: PdfItem[],
  opts: PdfOptions = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: opts.paper ?? 'LETTER',
    margin: MARGIN,
    autoFirstPage: false,
    info: {
      Title: items.length === 1 ? items[0].title : 'Monkee Business charts',
    },
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  for (const item of items) {
    doc.addPage()
    drawPage(doc, item)
  }
  if (!items.length) doc.addPage()
  doc.end()
  return done
}
