export const dynamic = 'force-dynamic'

import {requireAdmin} from '@/lib/guard'
import {route} from '@/lib/route'
import {BandImport} from '@/lib/band-import-schema'
import {importBand} from '@/lib/band-import'

/** Bigger than any batch the Import page sends (it sends 100 songs at a time) */
const MAX_BYTES = 8 * 1024 * 1024

/**
 * One batch from the Import page, added to the current band. Admins only:
 * it can add hundreds of songs at once. Adds, never changes (see importBand).
 */
export const POST = route(async (req: Request) => {
  const {user, band} = await requireAdmin()
  const raw = await req.text()
  if (raw.length > MAX_BYTES)
    return Response.json(
      {error: 'That batch is too big. Import fewer songs at a time.'},
      {status: 413},
    )
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({error: 'That isn’t an import.'}, {status: 400})
  }
  const parsed = BandImport.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return Response.json(
      {
        error: `Something in the import isn’t right (${issue.path.join('.')}: ${issue.message}).`,
      },
      {status: 400},
    )
  }
  const summary = await importBand(parsed.data, {
    bandId: band.id,
    userId: user.id,
  })
  return Response.json(summary)
})
