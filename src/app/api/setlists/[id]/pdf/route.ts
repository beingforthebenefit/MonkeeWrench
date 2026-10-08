export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import {requireSession} from '@/lib/guard'
import {getSetlist} from '@/lib/setlists'
import {renderChartsPdf, renderSetSheetPdf, type SheetSet} from '@/lib/pdf'
import {buildPdfItem, paperFrom, pdfCues, pdfResponse} from '@/lib/chart-pdf'
import {detectKey, parseChordPro} from '@/lib/chordpro'
import {formatClock, runningOrder, timeRange} from '@/lib/gig'
import {route} from '@/lib/route'

/**
 * GET /api/setlists/:id/pdf
 * - charts (default): one song per page, in order, each in its set key
 *   with its note; numbered within its set
 * - ?sheet=1: the set list itself, one page per set in big type, to tape
 *   to the floor
 */
export const GET = route(
  async (req: Request, {params}: {params: {id: string}}) => {
    const {user, band} = await requireSession()
    const url = new URL(req.url)
    const set = await getSetlist(params.id, band.id)
    if (!set) return new Response('Not Found', {status: 404})
    const {entries, sets, divided} = runningOrder(set.startTime, set.items)
    const paper = paperFrom(url)

    if (url.searchParams.get('sheet') === '1') {
      const pages: SheetSet[] = sets.map((s) => ({
        heading: divided ? s.label : set.name,
        when: [timeRange(s.start, s.end), divided ? set.name : null]
          .filter(Boolean)
          .join('  ·  '),
        songs: [],
      }))
      for (const e of entries)
        if (e.kind === 'SONG' && e.item.song) {
          const v = e.item.song.chartVersions[0]
          const key =
            e.item.key || (v ? detectKey(parseChordPro(v.source)) : null)
          pages[e.set]?.songs.push({title: e.item.song.title, key})
        }
      const start =
        sets[0]?.start != null ? formatClock(sets[0].start, true) : null
      const buf = await renderSetSheetPdf(
        pages.filter((p) => p.songs.length),
        {paper, footer: [band.name, start].filter(Boolean).join('  ·  ')},
      )
      return pdfResponse(
        buf,
        `${set.name} set list`,
        url.searchParams.has('download'),
      )
    }

    const cues =
      url.searchParams.get('cues') === '1'
        ? await pdfCues(
            user.id,
            set.items.flatMap((i) => (i.songId ? [i.songId] : [])),
          )
        : null
    const items = entries.flatMap((e) => {
      if (e.kind !== 'SONG' || !e.item.song?.chartVersions[0]) return []
      const s = e.item.song
      const item = buildPdfItem(band, s, s.chartVersions[0], {
        key: e.item.key,
        note: e.item.note,
      })
      return [
        {
          ...item,
          title: `${e.n}. ${item.title}`,
          // Which set, when the gig is divided
          subtitle: divided
            ? [sets[e.set].label, item.subtitle].filter(Boolean).join('   ·   ')
            : item.subtitle,
          cues: cues?.get(s.id),
        },
      ]
    })
    const buf = await renderChartsPdf(items, {paper})
    return pdfResponse(buf, set.name, url.searchParams.has('download'))
  },
)
