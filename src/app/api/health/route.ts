export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'

// For monitoring (popos check_health.py, the container healthcheck). Touches
// the database, because the pages can render while Postgres is down. Public
// and content-free: it reports counts, never titles or charts.
export const GET = async () => {
  try {
    const songs = await prisma.song.count()
    return Response.json({ok: true, songs})
  } catch {
    return Response.json(
      {ok: false, error: 'database unreachable'},
      {status: 503},
    )
  }
}
