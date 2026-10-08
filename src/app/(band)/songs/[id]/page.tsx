export const dynamic = 'force-dynamic'

import {notFound} from 'next/navigation'
import {prisma} from '@/lib/db'
import {displayName, getSong, isImportNote} from '@/lib/songs'
import ChartScreen from '@/components/ChartScreen'
import {pageSession} from '@/lib/guard'
import {followToBand} from '@/lib/band'
import {myCues} from '@/lib/cues-server'

export async function generateMetadata({params}: {params: {id: string}}) {
  const {band} = await pageSession()
  const song = await prisma.song.findFirst({
    where: {id: params.id, bandId: band.id},
    select: {title: true},
  })
  return {title: song?.title ?? 'Song'}
}

export default async function SongPage({params}: {params: {id: string}}) {
  const {user, band} = await pageSession()
  const song = await getSong(params.id, band.id)
  if (!song) {
    await followToBand('song', params.id, user.id, `/songs/${params.id}`)
    notFound()
  }
  const [versions, cues] = await Promise.all([
    prisma.chartVersion.count({where: {songId: song.id}}),
    myCues(user.id, [song.id]),
  ])
  return (
    <ChartScreen
      song={{
        id: song.id,
        title: song.title,
        writer: song.writer,
        leadSinger: song.leadSinger,
        guitars: song.guitars,
        seconds: song.seconds,
        keys: song.keys,
        percussion: song.percussion,
        youtubeUrl: song.youtubeUrl,
        lyricsUrl: song.lyricsUrl,
        notes: song.notes,
        ready: song.status === 'READY',
      }}
      source={song.latest?.source ?? ''}
      version={song.latest?.number ?? 0}
      versions={versions}
      editedBy={song.latest ? displayName(song.latest.author) : null}
      editedAt={song.latest?.createdAt.toISOString() ?? null}
      imported={isImportNote(song.latest?.note)}
      cues={cues.get(song.id) ?? []}
    />
  )
}
