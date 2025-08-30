import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const count = await prisma.proposal.count({
    where: { status: 'PENDING', archivedAt: null as any },
  })
  return NextResponse.json({ count })
}
