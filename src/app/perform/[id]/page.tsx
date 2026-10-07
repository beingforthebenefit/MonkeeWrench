export const dynamic = 'force-dynamic'

import {getServerSession} from 'next-auth'
import {notFound, redirect} from 'next/navigation'
import {authOptions} from '@/lib/auth'
import {getSetlist} from '@/lib/setlists'
import Perform, {type PerformSong} from '@/components/Perform'

export const metadata = {title: 'Perform · Monkee Wrench'}

export default async function PerformPage({params}: {params: {id: string}}) {
  const session = await getServerSession(authOptions)
  if (!session?.user)
    redirect(
      '/login?callbackUrl=' + encodeURIComponent(`/perform/${params.id}`),
    )
  const set = await getSetlist(params.id)
  if (!set) notFound()
  // Every chart in the set is sent with the page, so once it has loaded the
  // whole set works without a connection.
  const songs: PerformSong[] = set.items.map((i) => ({
    id: i.song.id,
    title: i.song.title,
    leadSinger: i.song.leadSinger,
    source: i.song.chartVersions[0]?.source ?? '',
    key: i.key,
    note: i.note,
  }))
  return <Perform setId={set.id} name={set.name} songs={songs} />
}
