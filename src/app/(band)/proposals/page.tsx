export const dynamic = 'force-dynamic'

import {requireSession} from '@/lib/guard'
import {getBoard} from '@/lib/proposals'
import Proposals from '@/components/Proposals'

export const metadata = {title: 'Proposals · Monkee Wrench'}

export default async function ProposalsPage() {
  const {user} = await requireSession()
  const board = await getBoard(user.id)
  return <Proposals board={board} isAdmin={user.isAdmin} />
}
