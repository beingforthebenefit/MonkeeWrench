export const dynamic = 'force-dynamic'

import {getServerSession} from 'next-auth'
import {notFound, redirect} from 'next/navigation'
import {authOptions} from '@/lib/auth'
import {pageSession} from '@/lib/guard'
import {followToBand} from '@/lib/band'
import {getSetlist} from '@/lib/setlists'
import Perform, {type PerformSong} from '@/components/Perform'
import {myCues} from '@/lib/cues-server'

export const metadata = {title: 'Perform'}

export default async function PerformPage({params}: {params: {id: string}}) {
  const session = await getServerSession(authOptions)
  if (!session?.user)
    redirect(
      '/login?callbackUrl=' + encodeURIComponent(`/perform/${params.id}`),
    )
  const {user, band} = await pageSession()
  const set = await getSetlist(params.id, band.id)
  if (!set) {
    await followToBand('setlist', params.id, user.id, `/perform/${params.id}`)
    notFound()
  }
  // Every chart in the set is sent with the page, so once it has loaded the
  // whole set works without a connection.
  const cues = await myCues(
    user.id,
    set.items.map((i) => i.songId),
  )
  const songs: PerformSong[] = set.items.map((i) => ({
    id: i.song.id,
    title: i.song.title,
    leadSinger: i.song.leadSinger,
    source: i.song.chartVersions[0]?.source ?? '',
    key: i.key,
    note: i.note,
    cues: cues.get(i.songId) ?? [],
  }))
  return <Perform setId={set.id} name={set.name} songs={songs} />
}
