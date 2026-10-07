export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {renderChartsPdf} from '@/lib/pdf'
import {buildPdfItem, paperFrom, pdfResponse} from '@/lib/chart-pdf'
import {route} from '@/lib/route'

// GET /api/songs/:id/pdf?key=A&version=3&paper=A4&download=1
export const GET = route(
  async (req: Request, {params}: {params: {id: string}}) => {
    await requireSession()
    const url = new URL(req.url)
    const song = await prisma.song.findUnique({where: {id: params.id}})
    if (!song) return new Response('Not Found', {status: 404})
    const n = Number(url.searchParams.get('version'))
    const version = await prisma.chartVersion.findFirst({
      where: {
        songId: song.id,
        ...(Number.isInteger(n) && n > 0 ? {number: n} : {}),
      },
      orderBy: {number: 'desc'},
      include: {author: {select: {name: true, displayName: true, email: true}}},
    })
    if (!version) return new Response('Not Found', {status: 404})
    const item = buildPdfItem(song, version, {key: url.searchParams.get('key')})
    const buf = await renderChartsPdf([item], {paper: paperFrom(url)})
    const suffix = n > 0 ? ` (v${version.number})` : ''
    return pdfResponse(
      buf,
      song.title + suffix,
      url.searchParams.has('download'),
    )
  },
)
