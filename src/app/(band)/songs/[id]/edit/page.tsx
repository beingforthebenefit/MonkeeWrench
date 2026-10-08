export const dynamic = 'force-dynamic'

import {notFound} from 'next/navigation'
import {getSong} from '@/lib/songs'
import ChartEditor from '@/components/ChartEditor'
import {pageSession} from '@/lib/guard'

export const metadata = {title: 'Edit'}

export default async function EditSongPage({params}: {params: {id: string}}) {
  const {band} = await pageSession()
  const song = await getSong(params.id, band.id)
  if (!song) notFound()
  return (
    <ChartEditor
      songId={song.id}
      initialFields={{
        title: song.title,
        writer: song.writer ?? '',
        leadSinger: song.leadSinger ?? '',
        guitars: song.guitars == null ? '' : String(song.guitars),
        keys: song.keys ?? '',
        percussion: song.percussion ?? '',
        youtubeUrl: song.youtubeUrl ?? '',
        lyricsUrl: song.lyricsUrl ?? '',
        status: song.status,
        notes: song.notes ?? '',
      }}
      initialSource={song.latest?.source ?? ''}
      baseNumber={song.latest?.number ?? 0}
    />
  )
}
