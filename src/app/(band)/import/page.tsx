export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {pageAdmin} from '@/lib/guard'
import Importer from '@/components/import/Importer'

export const metadata = {title: 'Import'}

/** Bring a band's songs and setlists in from OnSong, Docs, files, a sheet. */
export default async function ImportPage() {
  const {band} = await pageAdmin()
  const songs = await prisma.song.findMany({
    where: {bandId: band.id},
    select: {title: true},
    orderBy: {title: 'asc'},
  })
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-3xl font-extrabold">Import</h1>
      <p className="mt-1 text-muted">
        Bring {band.name}’s songs and setlists in from OnSong, Google Docs,
        ChordPro files or a spreadsheet. Files are read on this device; only the
        songs you choose are sent. Nothing already in the band is changed.
      </p>
      <Importer existing={songs.map((s) => s.title)} />
    </main>
  )
}
