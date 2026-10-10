export const dynamic = 'force-dynamic'

import {requireAdmin} from '@/lib/guard'
import {route} from '@/lib/route'
import {exportBand} from '@/lib/band-export'
import {slugify} from '@/lib/band-fields'

/** The whole band as one file, to keep or to move to another install. */
export const GET = route(async () => {
  const {user, band} = await requireAdmin()
  const data = await exportBand(band.id, user.id)
  const file = `${slugify(band.name) || 'band'}-${new Date().toISOString().slice(0, 10)}.bandstand.json`
  return new Response(
    JSON.stringify(
      {
        format: 'bandstand',
        version: 1,
        band: band.name,
        exported: new Date().toISOString(),
        ...data,
      },
      null,
      1,
    ),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Cache-Control': 'no-store',
      },
    },
  )
})
