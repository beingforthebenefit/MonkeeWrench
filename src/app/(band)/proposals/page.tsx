export const dynamic = 'force-dynamic'

import {pageSession} from '@/lib/guard'
import {getBoard} from '@/lib/proposals'
import Proposals from '@/components/Proposals'

export const metadata = {title: 'Proposals'}

export default async function ProposalsPage() {
  const {user, band, isAdmin} = await pageSession()
  const board = await getBoard(user.id, band)
  return (
    <Proposals board={board} isAdmin={isAdmin} tributeTo={band.tributeTo} />
  )
}
