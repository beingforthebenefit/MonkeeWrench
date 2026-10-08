export const dynamic = 'force-dynamic'

import {pageUser} from '@/lib/guard'
import {bandForHost, myBands, requestHost} from '@/lib/band'
import BandPicker from '@/components/BandPicker'

export const metadata = {title: 'Your bands'}

/**
 * The band picker, for people in more than one. The band this address
 * belongs to goes first. Someone in one band never sees this page.
 */
export default async function BandsPage({
  searchParams,
}: {
  searchParams: {next?: string}
}) {
  const {user} = await pageUser()
  const [bands, here] = await Promise.all([
    myBands(user.id),
    bandForHost(requestHost()),
  ])
  const ordered = [
    ...bands.filter((b) => b.id === here?.id),
    ...bands.filter((b) => b.id !== here?.id),
  ]
  const next = searchParams.next
  return (
    <BandPicker
      bands={ordered.map((b) => ({
        id: b.id,
        name: b.name,
        appName: b.appName,
        iconAt: b.iconAt?.getTime() ?? null,
      }))}
      next={
        next && next.startsWith('/') && !next.startsWith('//') ? next : '/songs'
      }
      isOwner={user.isOwner}
    />
  )
}
