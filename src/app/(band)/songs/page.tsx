export const dynamic = 'force-dynamic'

import {detectKey, parseChordPro} from '@/lib/chordpro'
import {displayName, isImportNote, listSongs} from '@/lib/songs'
import {pageSession} from '@/lib/guard'
import SongLibrary, {type LibrarySong} from '@/components/SongLibrary'

export const metadata = {title: 'Songs'}

export default async function SongsPage() {
  const {band} = await pageSession()
  const songs = await listSongs(band.id)
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
      imported: isImportNote(s.latest?.note),
    }
  })
  return <SongLibrary songs={rows} />
}
