export const dynamic = 'force-dynamic'

import {notFound} from 'next/navigation'
import {prisma} from '@/lib/db'
import {pageSession} from '@/lib/guard'
import {getSetlist} from '@/lib/setlists'
import {detectKey, parseChordPro} from '@/lib/chordpro'
import {displayName} from '@/lib/songs'
import SetlistEditor, {
  type Item,
  type PickSong,
} from '@/components/SetlistEditor'

export const metadata = {title: 'Setlist'}

export default async function SetlistPage({params}: {params: {id: string}}) {
  const {band, isAdmin} = await pageSession()
  const set = await getSetlist(params.id, band.id)
  if (!set) notFound()
  const songs = await prisma.song.findMany({
    where: {bandId: band.id},
    orderBy: [{status: 'asc'}, {title: 'asc'}],
    include: {
      chartVersions: {
        orderBy: {number: 'desc'},
        take: 1,
        select: {source: true},
      },
    },
  })
  const library: PickSong[] = songs.map((s) => ({
    id: s.id,
    title: s.title,
    ready: s.status === 'READY',
    leadSinger: s.leadSinger,
    seconds: s.seconds,
    key: s.chartVersions[0]
      ? detectKey(parseChordPro(s.chartVersions[0].source))
      : null,
  }))
  return (
    <SetlistEditor
      id={set.id}
      library={library}
      initial={{
        name: set.name,
        gigDate: set.gigDate ? set.gigDate.toISOString().slice(0, 10) : '',
        startTime: set.startTime ?? '',
        venue: set.venue ?? '',
        notes: set.notes ?? '',
        items: set.items.map(
          (i): Item =>
            i.kind === 'SET'
              ? {
                  uid: i.id,
                  kind: 'SET',
                  label: i.label ?? 'Set',
                  minutes: i.minutes ? String(i.minutes) : '',
                  startTime: i.startTime ?? '',
                }
              : i.kind === 'BREAK'
                ? {
                    uid: i.id,
                    kind: 'BREAK',
                    minutes: i.minutes ? String(i.minutes) : '',
                  }
                : {
                    uid: i.id,
                    kind: 'SONG',
                    songId: i.songId ?? '',
                    note: i.note ?? '',
                    key: i.key ?? '',
                  },
        ),
      }}
      editedBy={displayName(set.updatedBy)}
      editedAt={set.updatedAt.toISOString()}
      canDelete={isAdmin}
    />
  )
}
