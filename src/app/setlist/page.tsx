export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'

type Row = {
  id: string
  title: string
  artist: string
  chartUrl: string | null
  lyricsUrl: string | null
  youtubeUrl: string | null
}

export default async function Setlist() {
  const rows = await prisma.proposal.findMany({
    where: { status: 'APPROVED' },
    orderBy: { updatedAt: 'desc' },
  })

  const items = rows as Row[]

  return (
    <div>
      <h2>Setlist</h2>
      <ul>
        {items.map((i: Row) => (
          <li key={i.id}>
            {i.title} — {i.artist}{' '}
            {i.chartUrl && (
              <a href={i.chartUrl} target="_blank" rel="noreferrer">
                Chart
              </a>
            )}{' '}
            {i.lyricsUrl && (
              <a href={i.lyricsUrl} target="_blank" rel="noreferrer">
                Lyrics
              </a>
            )}{' '}
            {i.youtubeUrl && (
              <a href={i.youtubeUrl} target="_blank" rel="noreferrer">
                YouTube
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
