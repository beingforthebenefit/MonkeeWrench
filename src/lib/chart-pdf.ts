import {
  detectKey,
  parseChordPro,
  semitonesBetween,
  transposeChart,
} from './chordpro'
import type {PdfItem} from './pdf'
import {displayName} from './songs'

type SongLike = {
  title: string
  writer: string | null
  leadSinger: string | null
}
type VersionLike = {
  number: number
  source: string
  createdAt: Date
  author: {
    name: string | null
    email: string | null
    displayName?: string | null
  } | null
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Los_Angeles',
})

/** Build one PDF page's content; `key` transposes to that key when given. */
export function buildPdfItem(
  song: SongLike,
  version: VersionLike,
  opts: {key?: string | null; note?: string | null} = {},
): PdfItem {
  const original = parseChordPro(version.source)
  const fromKey = detectKey(original)
  const steps = opts.key && fromKey ? semitonesBetween(fromKey, opts.key) : 0
  const chart = transposeChart(original, steps)
  const key = detectKey(chart)
  const subtitle = [
    song.writer,
    song.leadSinger && `Lead: ${song.leadSinger}`,
    key && `Key: ${key}${steps && fromKey ? ` (original ${fromKey})` : ''}`,
  ]
    .filter(Boolean)
    .join('   ·   ')
  return {
    title: song.title,
    subtitle,
    chart,
    note: opts.note,
    footer: `Monkee Business  ·  ${song.title}  ·  version ${version.number}, edited by ${displayName(version.author)} on ${dateFmt.format(version.createdAt)}`,
  }
}

export function pdfResponse(buf: Buffer, filename: string, download: boolean) {
  const safe = filename.replace(/[^\w .()'-]+/g, '').trim() || 'chart'
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safe}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export function paperFrom(url: URL): 'LETTER' | 'A4' {
  return url.searchParams.get('paper')?.toUpperCase() === 'A4' ? 'A4' : 'LETTER'
}
