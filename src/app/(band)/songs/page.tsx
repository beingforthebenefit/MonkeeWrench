export const dynamic = 'force-dynamic'

import {detectKey, parseChordPro} from '@/lib/chordpro'
import {displayName, listSongs} from '@/lib/songs'
import SongLibrary, {type LibrarySong} from '@/components/SongLibrary'

export const metadata = {title: 'Songs · Monkee Wrench'}

export default async function SongsPage() {
  const songs = await listSongs()
  const rows: LibrarySong[] = songs.map((s) => {
    const chart = s.latest ? parseChordPro(s.latest.source) : null
    return {
      id: s.id,
      title: s.title,
      leadSinger: s.leadSinger,
      writer: s.writer,
      ready: s.status === 'READY',
      key: chart ? detectKey(chart) : null,
      hasChart: Boolean(chart?.sections.length),
      editedBy: s.latest ? displayName(s.latest.author) : null,
      editedAt: s.latest?.createdAt.toISOString() ?? null,
    }
  })
  return <SongLibrary songs={rows} />
}
