export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import {requireSession} from '@/lib/guard'
import {getSetlist} from '@/lib/setlists'
import {renderChartsPdf} from '@/lib/pdf'
import {buildPdfItem, paperFrom, pdfCues, pdfResponse} from '@/lib/chart-pdf'
import {route} from '@/lib/route'

// The whole set in order, one song per page, each in its set key with its note.
export const GET = route(
  async (req: Request, {params}: {params: {id: string}}) => {
    const {user, band} = await requireSession()
    const url = new URL(req.url)
    const set = await getSetlist(params.id, band.id)
    if (!set) return new Response('Not Found', {status: 404})
    const cues =
      url.searchParams.get('cues') === '1'
        ? await pdfCues(
            user.id,
            set.items.map((i) => i.songId),
          )
        : null
    const items = set.items
      .filter((i) => i.song.chartVersions[0])
      .map((i, n) => {
        const item = buildPdfItem(band, i.song, i.song.chartVersions[0], {
          key: i.key,
          note: i.note,
        })
        return {
          ...item,
          title: `${n + 1}. ${item.title}`,
          cues: cues?.get(i.songId),
        }
      })
    const buf = await renderChartsPdf(items, {paper: paperFrom(url)})
    return pdfResponse(buf, set.name, url.searchParams.has('download'))
  },
)
