import {NextResponse} from 'next/server'
import {prisma} from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const count = await prisma.proposal.count({
    where: {status: 'PENDING'},
  })
  return NextResponse.json({count})
}
