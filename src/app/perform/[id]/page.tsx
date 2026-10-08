export const dynamic = 'force-dynamic'

import {getServerSession} from 'next-auth'
import {notFound, redirect} from 'next/navigation'
import {authOptions} from '@/lib/auth'
import {pageSession} from '@/lib/guard'
import {followToBand} from '@/lib/band'
import {getSetlist} from '@/lib/setlists'
import Perform, {type PerformSong} from '@/components/Perform'
import {myCues} from '@/lib/cues-server'
import {formatClock, runningOrder} from '@/lib/gig'

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
  const {entries, sets, divided} = runningOrder(set.startTime, set.items)
  const cues = await myCues(
    user.id,
    set.items.flatMap((i) => (i.songId ? [i.songId] : [])),
  )
  const songs: PerformSong[] = []
  entries.forEach((e, at) => {
    if (e.kind !== 'SONG' || !e.item.song) return
    const s = e.item.song
    // What comes between this song and the next one: a break, or a new set
    const brk = entries.slice(at + 1).findIndex((x) => x.kind === 'SONG')
    const gap = entries.slice(at + 1, brk < 0 ? undefined : at + 1 + brk)
    const pause = gap.find((x) => x.kind === 'BREAK')
    const nextSet = gap.find((x) => x.kind === 'SET')
    songs.push({
      id: s.id,
      title: s.title,
      leadSinger: s.leadSinger,
      source: s.chartVersions[0]?.source ?? '',
      key: e.item.key,
      note: e.item.note,
      cues: cues.get(s.id) ?? [],
      set: divided
        ? {label: sets[e.set].label, n: e.n, count: sets[e.set].songs}
        : null,
      after:
        pause?.kind === 'BREAK'
          ? {
              kind: 'break',
              minutes: pause.info.minutes,
              until:
                pause.info.end != null ? formatClock(pause.info.end) : null,
            }
          : nextSet?.kind === 'SET' && brk >= 0
            ? {kind: 'set', label: nextSet.info.label}
            : null,
    })
  })
  return <Perform setId={set.id} name={set.name} songs={songs} />
}
