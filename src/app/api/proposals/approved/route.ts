import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const items = await prisma.proposal.findMany({
    where: { status: 'APPROVED'},
    orderBy: [
      { setlistOrder: 'asc' },   // nulls last in Postgres
      { updatedAt: 'desc' },
    ],
    select: {
      id: true, title: true, artist: true,
      chartUrl: true, lyricsUrl: true, youtubeUrl: true,
      updatedAt: true, setlistOrder: true,
    }
  })
  return NextResponse.json(items)
}
