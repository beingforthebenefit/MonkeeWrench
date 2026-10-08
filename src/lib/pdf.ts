import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import {detectKey, isChord, transposeKey} from './chordpro'
import type {Chart, ChartLine, Section} from './chordpro'
import {anchorLabel, placeCues} from './cues'
import {withAbcHeader} from './abc'
import {renderAbcSvgs, type AbcSvg} from './abc-svg'

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
  /** The reader's own cues, when they asked for them on the PDF */
  cues?: PdfCue[]
  /** The chart's original key and how far it's transposed (for cue notation) */
  originalKey?: string | null
  steps?: number
}

export type PdfCue = {
  id: string
  anchor: string
  position: number
  kind: 'TEXT' | 'IMAGE' | 'ABC'
  text: string | null
  image: {data: Buffer; width: number; height: number} | null
}

/** A picture in the flow: drawn notation, or a cue's photo. */
type Graphic =
  | {kind: 'svg'; svg: string; width: number; height: number}
  | {kind: 'img'; data: Buffer; width: number; height: number}

/** Extras for one chart, ready to lay out. */
type Extras = {
  top: Extra[]
  sections: Map<number, Extra[]>
  /** Drawn notation for {start_of_abc} sections, by section index */
  abc: Map<number, Graphic | null>
}
type Extra = {text?: string; graphic?: Graphic | null; where?: string}

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

/** A unit of vertical flow: a label, a line, a cue or a picture. */
type Block =
  | {kind: 'label'; section: Section; h: number}
  | {kind: 'line'; line: ChartLine; h: number}
  | {kind: 'cue'; text: string; h: number}
  | {kind: 'graphic'; g: Graphic; w: number; h: number}

const CUE_FONT = 'Helvetica-Oblique'
const NO_EXTRAS: Extras = {top: [], sections: new Map(), abc: new Map()}

/**
 * A picture's size in a column: notation follows the type size; a photo
 * takes the column. Either is capped in height so one picture can't take
 * over the page.
 */
function graphicSize(g: Graphic, size: number, colW: number) {
  const aspect = g.height / g.width
  // abcjs draws in CSS px; 0.75 pt each at 12 pt type
  let w = g.kind === 'svg' ? g.width * 0.75 * (size / 12) : colW
  w = Math.min(w, colW)
  let h = w * aspect
  const maxH = size * 16
  if (h > maxH) {
    h = maxH
    w = h / aspect
  }
  return {w, h}
}

function extraBlocks(doc: Doc, list: Extra[], size: number, colW: number) {
  const out: Block[] = []
  for (const e of list) {
    const text = [e.where, e.text].filter(Boolean).join(' — ')
    if (e.graphic) {
      const {w, h} = graphicSize(e.graphic, size, colW)
      out.push({kind: 'graphic', g: e.graphic, w, h: h + size * 0.4})
    }
    if (text) {
      doc.font(CUE_FONT).fontSize(size * 0.85)
      const h = doc.heightOfString(text, {width: colW - 10})
      out.push({kind: 'cue', text, h: h + size * 0.45})
    }
  }
  return out
}

function toBlocks(
  doc: Doc,
  chart: Chart,
  size: number,
  colW: number,
  extras: Extras = NO_EXTRAS,
): Block[] {
  const blocks: Block[] = extraBlocks(doc, extras.top, size, colW)
  chart.sections.forEach((s, si) => {
    if (s.label || !['abc', 'part', 'tab'].includes(s.type))
      blocks.push({kind: 'label', section: s, h: size * 1.5})
    blocks.push(...extraBlocks(doc, extras.sections.get(si) ?? [], size, colW))
    const notation = extras.abc.get(si)
    if (notation) {
      const {w, h} = graphicSize(notation, size, colW)
      blocks.push({kind: 'graphic', g: notation, w, h: h + size * 0.6})
    } else if (s.abc)
      // Couldn't draw it: print the notation as text rather than nothing
      blocks.push({
        kind: 'cue',
        text: s.abc,
        h: size * 1.3 * s.abc.split('\n').length,
      })
    s.lines.forEach((line, i) => {
      const gap = i === s.lines.length - 1 ? size * 0.6 : 0
      blocks.push({kind: 'line', line, h: lineHeight(line, size) + gap})
    })
  })
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
    // Keep a label together with whatever comes right after it
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
  extras: Extras = NO_EXTRAS,
): Layout {
  const colW = (width - GUTTER) / 2
  const colWidth = (cols: number) => (cols === 2 ? colW : width)
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 0.5) {
    const w = widest(doc, chart, size)
    for (const cols of [1, 2]) {
      if (w > colWidth(cols)) continue
      const blocks = toBlocks(doc, chart, size, colWidth(cols), extras)
      const f = flow(blocks, cols, firstTop, contTop, bottom)
      if (f.pages === 1) return {size, cols, ...f}
    }
  }
  // Too long for one page: keep the type readable and use more pages
  let size = READABLE_SIZE
  while (size > MIN_SIZE && widest(doc, chart, size) > width) size -= 0.5
  const cols = widest(doc, chart, size) <= colW ? 2 : 1
  const blocks = toBlocks(doc, chart, size, colWidth(cols), extras)
  return {size, cols, ...flow(blocks, cols, firstTop, contTop, bottom)}
}

/** A cue: a thin bar on the left, then the note in italics. */
function drawCue(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  size: number,
  colW: number,
) {
  doc.font(CUE_FONT).fontSize(size * 0.85)
  const h = doc.heightOfString(text, {width: colW - 10})
  doc.rect(x, y, 2, h).fill('#888')
  doc.fillColor('#333').text(text, x + 8, y, {width: colW - 10})
}

function drawGraphic(
  doc: Doc,
  g: Graphic,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (g.kind === 'img') doc.image(g.data, x, y, {width: w, height: h})
  else
    SVGtoPDF(doc, g.svg, x, y, {
      width: w,
      height: h,
      preserveAspectRatio: 'xMinYMin meet',
    })
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

function drawPage(doc: Doc, item: PdfItem, extras: Extras) {
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
  const layout = fitLayout(doc, item.chart, width, y, contTop, bottom, extras)
  const colW = layout.cols === 2 ? (width - GUTTER) / 2 : width
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
    const b = p.block
    if (b.kind === 'label')
      drawLabel(doc, b.section, colX(p.col), p.y, layout.size)
    else if (b.kind === 'line')
      drawLine(doc, b.line, colX(p.col), p.y, layout.size)
    else if (b.kind === 'cue')
      drawCue(doc, b.text, colX(p.col), p.y, layout.size, colW)
    else drawGraphic(doc, b.g, colX(p.col), p.y, b.w, b.h - layout.size * 0.5)
  }
  footer(page)
}

/**
 * Notation and cues, prepared for layout. All notation in the PDF is drawn
 * in one worker run (see abc-svg.ts).
 */
async function prepareExtras(items: PdfItem[]): Promise<Extras[]> {
  type Pending = {item: number; set: (g: Graphic | null) => void}
  const jobs: {abc: string; steps: number}[] = []
  const pending: Pending[] = []
  const svg = (s: AbcSvg | null): Graphic | null =>
    s ? {kind: 'svg', ...s} : null

  const out = items.map((item, n) => {
    const extras: Extras = {top: [], sections: new Map(), abc: new Map()}
    const shownKey = detectKey(item.chart)
    item.chart.sections.forEach((s, si) => {
      if (!s.abc) return
      const steps = s.abcSteps ?? 0
      const key = shownKey && steps ? transposeKey(shownKey, -steps) : shownKey
      jobs.push({abc: withAbcHeader(s.abc, key ?? 'C'), steps})
      pending.push({item: n, set: (g) => extras.abc.set(si, g)})
    })
    if (item.cues?.length) {
      const placed = placeCues(item.chart, item.cues)
      const toExtra = (c: PdfCue, where?: string): Extra => {
        const e: Extra = {where, text: c.text ?? undefined}
        if (c.kind === 'IMAGE' && c.image) e.graphic = {kind: 'img', ...c.image}
        if (c.kind === 'ABC' && c.text) {
          e.text = undefined
          jobs.push({
            abc: withAbcHeader(c.text, item.originalKey ?? 'C'),
            steps: item.steps ?? 0,
          })
          pending.push({
            item: n,
            set: (g) => {
              e.graphic = g
              // Couldn't draw it: print the notation as text instead
              if (!g) e.text = c.text ?? undefined
            },
          })
        }
        return e
      }
      extras.top = [
        ...placed.lost.map((c) =>
          toExtra(c, `Was on ${anchorLabel(c.anchor)}`),
        ),
        ...placed.top.map((c) => toExtra(c)),
      ]
      placed.sections.forEach((list, si) =>
        extras.sections.set(
          si,
          list.map((c) => toExtra(c)),
        ),
      )
    }
    return extras
  })
  const drawn = await renderAbcSvgs(jobs)
  drawn.forEach((d, i) => pending[i].set(svg(d)))
  return out
}

export async function renderChartsPdf(
  items: PdfItem[],
  opts: PdfOptions = {},
): Promise<Buffer> {
  const extras = await prepareExtras(items)
  const doc = new PDFDocument({
    size: opts.paper ?? 'LETTER',
    margin: MARGIN,
    autoFirstPage: false,
    info: {
      Title: items.length === 1 ? items[0].title : 'Charts',
    },
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  items.forEach((item, i) => {
    doc.addPage()
    drawPage(doc, item, extras[i])
  })
  if (!items.length) doc.addPage()
  doc.end()
  return done
}

export type SheetSet = {
  heading: string
  when: string
  songs: {title: string; key: string | null}[]
}

/**
 * The set list to tape to the floor: one page per set, song titles as big
 * as fit, numbered, each with its key. Nothing else: it's read from six
 * feet away mid-song.
 */
export async function renderSetSheetPdf(
  sets: SheetSet[],
  opts: PdfOptions & {footer?: string} = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: opts.paper ?? 'LETTER',
    margin: MARGIN,
    autoFirstPage: false,
    info: {Title: 'Set list'},
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  for (const set of sets) {
    doc.addPage()
    const width = doc.page.width - MARGIN * 2
    let y = MARGIN
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#000')
    doc.text(set.heading, MARGIN, y, {width, lineBreak: false})
    y += 34
    if (set.when) {
      doc.font(LYRIC).fontSize(14).fillColor('#444')
      doc.text(set.when, MARGIN, y, {width, lineBreak: false})
      y += 20
    }
    y += 10
    doc
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + width, y)
      .lineWidth(2)
      .stroke('#000')
    y += 14

    // The biggest type that fits every song on the page, one line each
    const bottom = doc.page.height - MARGIN - 24
    const n = set.songs.length
    const numW = (size: number) => size * 1.6
    const fits = (size: number) => {
      if (y + n * size * 1.35 > bottom) return false
      doc.font('Helvetica-Bold').fontSize(size)
      return set.songs.every((s) => {
        const keyW = s.key ? doc.widthOfString(s.key) + size : 0
        return doc.widthOfString(s.title) + numW(size) + keyW <= width
      })
    }
    let size = 40
    while (size > 12 && !fits(size)) size -= 1
    set.songs.forEach((s, i) => {
      const lineY = y + i * size * 1.35
      doc
        .font(LYRIC)
        .fontSize(size * 0.7)
        .fillColor('#777')
      doc.text(String(i + 1), MARGIN, lineY + size * 0.2, {
        width: numW(size) - size * 0.4,
        align: 'right',
        lineBreak: false,
      })
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#000')
      doc.text(s.title, MARGIN + numW(size), lineY, {lineBreak: false})
      if (s.key) {
        doc
          .font('Helvetica')
          .fontSize(size * 0.8)
          .fillColor('#000')
        const kw = doc.widthOfString(s.key)
        doc.text(s.key, MARGIN + width - kw, lineY + size * 0.12, {
          lineBreak: false,
        })
      }
    })
    if (opts.footer) {
      const saved = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.font(LYRIC).fontSize(9).fillColor('#777')
      doc.text(opts.footer, MARGIN, doc.page.height - MARGIN + 12, {
        width,
        lineBreak: false,
      })
      doc.page.margins.bottom = saved
    }
  }
  if (!sets.length) doc.addPage()
  doc.end()
  return done
}
