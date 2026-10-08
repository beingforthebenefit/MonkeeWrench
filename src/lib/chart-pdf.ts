import {
  detectKey,
  parseChordPro,
  semitonesBetween,
  transposeChart,
} from './chordpro'
import type {PdfCue, PdfItem} from './pdf'
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

const dateFmt = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  })

/** Build one PDF page's content; `key` transposes to that key when given. */
export function buildPdfItem(
  band: {name: string; timezone: string},
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
    originalKey: fromKey,
    steps,
    footer: `${band.name}  ·  ${song.title}  ·  version ${version.number}, edited by ${displayName(version.author)} on ${dateFmt(band.timezone).format(version.createdAt)}`,
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

/** Someone's own cues on these songs, with picture bytes, for a PDF. */
export async function pdfCues(userId: string, songIds: string[]) {
  const {prisma} = await import('./db')
  const rows = await prisma.cue.findMany({
    where: {userId, songId: {in: songIds}},
    include: {image: true},
  })
  const out = new Map<string, PdfCue[]>()
  for (const r of rows)
    out.set(r.songId, [
      ...(out.get(r.songId) ?? []),
      {
        id: r.id,
        anchor: r.anchor,
        position: r.position,
        kind: r.kind,
        text: r.text,
        image: r.image
          ? {
              data: Buffer.from(r.image.data),
              width: r.image.width,
              height: r.image.height,
            }
          : null,
      },
    ])
  return out
}
