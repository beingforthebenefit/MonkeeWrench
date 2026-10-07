export const dynamic = 'force-dynamic'

import {notFound} from 'next/navigation'
import {prisma} from '@/lib/db'
import {displayName, getSong} from '@/lib/songs'
import ChartScreen from '@/components/ChartScreen'

export async function generateMetadata({params}: {params: {id: string}}) {
  const song = await prisma.song.findUnique({
    where: {id: params.id},
    select: {title: true},
  })
  return {title: song ? `${song.title} · Monkee Wrench` : 'Monkee Wrench'}
}

export default async function SongPage({params}: {params: {id: string}}) {
  const song = await getSong(params.id)
  if (!song) notFound()
  const versions = await prisma.chartVersion.count({where: {songId: song.id}})
  return (
    <ChartScreen
      song={{
        id: song.id,
        title: song.title,
        writer: song.writer,
        leadSinger: song.leadSinger,
        guitars: song.guitars,
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
    />
  )
}
