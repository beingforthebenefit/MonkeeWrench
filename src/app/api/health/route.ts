export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'

// For monitoring (popos check_health.py, the container healthcheck). Touches
// the database, because the pages can render while Postgres is down. Public
// and content-free: it reports counts, never titles or charts, and which
// commit is running (set at build; how to tell a deploy really happened).
export const GET = async () => {
  try {
    const songs = await prisma.song.count()
    return Response.json({
      ok: true,
      songs,
      version: process.env.GIT_SHA || null,
    })
  } catch {
    return Response.json(
      {ok: false, error: 'database unreachable'},
      {status: 503},
    )
  }
}
