import PDFDocument from 'pdfkit'
import {isChord} from './chordpro'
import type {Chart, ChartLine, Section} from './chordpro'

/**
 * Chart PDFs, generated on request from the stored ChordPro — there is no
 * stored PDF to go stale. Each song starts on a new page. Lines flow down
 * columns and onto further pages (a section may break between lines, but a
 * section label never sits alone at the bottom of a column). The type size is
 * the largest that fits the song on one page, down to MIN_SIZE; past that the
 * song runs onto more pages at READABLE_SIZE rather than getting smaller.
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
const READABLE_SIZE = 10
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
  if (line.kind === 'tab') return size * 1.05
  return (hasChords(line) ? size * 1.15 : 0) + (hasWords(line) ? size * 1.3 : 0)
}

function lineWidth(doc: Doc, line: ChartLine, size: number) {
  if (line.kind === 'tab') {
    doc.font('Courier').fontSize(size * 0.85)
    return doc.widthOfString(line.text)
  }
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

/** A unit of vertical flow: a section label or one line of a section. */
type Block =
  | {kind: 'label'; section: Section; h: number}
  | {kind: 'line'; line: ChartLine; h: number}

function toBlocks(chart: Chart, size: number): Block[] {
  const blocks: Block[] = []
  for (const s of chart.sections) {
    blocks.push({kind: 'label', section: s, h: size * 1.5})
    s.lines.forEach((line, i) => {
      const gap = i === s.lines.length - 1 ? size * 0.6 : 0
      blocks.push({kind: 'line', line, h: lineHeight(line, size) + gap})
    })
  }
  return blocks
}

type Placed = {block: Block; page: number; col: number; y: number}

/**
 * Flow blocks into columns. The first page starts lower (under the title);
 * later pages start at `contTop`. Returns placements and the page count.
 */
function flow(
  blocks: Block[],
  cols: number,
  firstTop: number,
  contTop: number,
  bottom: number,
) {
  const placed: Placed[] = []
  let page = 0
  let col = 0
  let top = firstTop
  let y = top
  const nextColumn = () => {
    col++
    if (col >= cols) {
      col = 0
      page++
      top = contTop
    }
    y = top
  }
  blocks.forEach((b, i) => {
    // Keep a label together with the first line after it
    const need =
      b.kind === 'label' && blocks[i + 1] ? b.h + blocks[i + 1].h : b.h
    if (y + need > bottom && y > top) nextColumn()
    placed.push({block: b, page, col, y})
    y += b.h
  })
  return {placed, pages: page + 1}
}

type Layout = {size: number; cols: number; placed: Placed[]; pages: number}

function widest(doc: Doc, chart: Chart, size: number) {
  let w = 0
  for (const s of chart.sections)
    for (const l of s.lines) w = Math.max(w, lineWidth(doc, l, size))
  return w
}

/** Largest size (and column count) that fits the song on one page. */
function fitLayout(
  doc: Doc,
  chart: Chart,
  width: number,
  firstTop: number,
  contTop: number,
  bottom: number,
): Layout {
  const colW = (width - GUTTER) / 2
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 0.5) {
    const w = widest(doc, chart, size)
    const blocks = toBlocks(chart, size)
    for (const cols of [1, 2]) {
      if (w > (cols === 2 ? colW : width)) continue
      const f = flow(blocks, cols, firstTop, contTop, bottom)
      if (f.pages === 1) return {size, cols, ...f}
    }
  }
  // Too long for one page: keep the type readable and use more pages
  let size = READABLE_SIZE
  while (size > MIN_SIZE && widest(doc, chart, size) > width) size -= 0.5
  const cols = widest(doc, chart, size) <= colW ? 2 : 1
  return {
    size,
    cols,
    ...flow(toBlocks(chart, size), cols, firstTop, contTop, bottom),
  }
}

function drawLine(
  doc: Doc,
  line: ChartLine,
  x: number,
  y: number,
  size: number,
) {
  if (line.kind === 'tab') {
    doc
      .font('Courier')
      .fontSize(size * 0.85)
      .fillColor('#000')
    doc.text(line.text, x, y, {lineBreak: false})
    return y + size * 1.05
  }
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
      // Remarks in the chord row ("REPEAT 3 X", "N.C.") print as notes
      if (isChord(seg.chord)) doc.font(CHORD).fontSize(size).fillColor('#000')
      else
        doc
          .font('Helvetica-Oblique')
          .fontSize(size * 0.9)
          .fillColor('#444')
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

function drawLabel(doc: Doc, s: Section, x: number, y: number, size: number) {
  const label = (s.label || s.type).toUpperCase()
  doc
    .font('Helvetica-Bold')
    .fontSize(size * 0.75)
    .fillColor('#555')
  doc.text(label + (s.note ? `  ·  ${s.note}` : ''), x, y, {
    lineBreak: false,
    characterSpacing: 0.8,
  })
}

function drawPage(doc: Doc, item: PdfItem) {
  const pageH = doc.page.height
  const width = doc.page.width - MARGIN * 2
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

  const contTop = MARGIN + 22
  const bottom = pageH - MARGIN - 6
  const layout = fitLayout(doc, item.chart, width, y, contTop, bottom)
  const colX = (col: number) =>
    layout.cols === 2 ? MARGIN + col * ((width - GUTTER) / 2 + GUTTER) : MARGIN

  const footer = (page: number) => {
    // Writing inside the bottom margin would make pdfkit start a new page
    const saved = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font(LYRIC).fontSize(8).fillColor('#555')
    const pageNote =
      layout.pages > 1 ? `  ·  page ${page + 1} of ${layout.pages}` : ''
    doc.text(item.footer + pageNote, MARGIN, pageH - MARGIN + 12, {
      width,
      lineBreak: false,
    })
    doc.page.margins.bottom = saved
  }

  let page = 0
  for (const p of layout.placed) {
    if (p.page !== page) {
      footer(page)
      doc.addPage()
      page = p.page
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#444')
      doc.text(`${item.title} (continued)`, MARGIN, MARGIN, {lineBreak: false})
    }
    if (p.block.kind === 'label')
      drawLabel(doc, p.block.section, colX(p.col), p.y, layout.size)
    else drawLine(doc, p.block.line, colX(p.col), p.y, layout.size)
  }
  footer(page)
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
