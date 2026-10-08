import {prisma} from './db'
import {displayName} from './songs'
import {avatarUrl} from './avatars'

export type BoardProposal = {
  id: string
  title: string
  artist: string
  youtubeUrl: string | null
  lyricsUrl: string | null
  proposer: string
  proposerAvatar: string | null
  proposedAt: string
  voters: {name: string; avatar: string | null}[]
  mine: boolean
}

/** Everything the Proposals page shows, in one query per list. */
export async function getBoard(userId: string) {
  const settings = await prisma.settings.findUnique({where: {id: 1}})
  const threshold =
    settings?.voteThreshold ?? Number(process.env.VOTE_THRESHOLD ?? 2)
  const who = {
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      avatarAt: true,
    },
  } as const
  const [pending, approved, archived] = await Promise.all([
    prisma.proposal.findMany({
      where: {status: 'PENDING'},
      orderBy: {createdAt: 'desc'},
      include: {
        proposer: who,
        votes: {include: {user: who}, orderBy: {createdAt: 'asc'}},
      },
    }),
    prisma.proposal.findMany({
      where: {status: 'APPROVED'},
      orderBy: {updatedAt: 'desc'},
      take: 8,
    }),
    prisma.proposal.findMany({
      where: {status: 'ARCHIVED'},
      orderBy: {updatedAt: 'desc'},
      take: 30,
      include: {proposer: who},
    }),
  ])
  // Link approved proposals to the song they became
  const songs = await prisma.song.findMany({
    where: {title: {in: approved.map((a) => a.title), mode: 'insensitive'}},
    select: {id: true, title: true},
  })
  const songByTitle = new Map(songs.map((s) => [s.title.toLowerCase(), s.id]))

  const toBoard = (p: (typeof pending)[number]): BoardProposal => ({
    id: p.id,
    title: p.title,
    artist: p.artist,
    youtubeUrl: p.youtubeUrl,
    lyricsUrl: p.lyricsUrl,
    proposer: displayName(p.proposer),
    proposerAvatar: avatarUrl(p.proposer),
    proposedAt: p.createdAt.toISOString(),
    voters: p.votes.map((v) => ({
      name: displayName(v.user),
      avatar: avatarUrl(v.user),
    })),
    mine: p.votes.some((v) => v.userId === userId),
  })

  return {
    threshold,
    pending: pending.map(toBoard),
    approved: approved.map((a) => ({
      id: a.id,
      title: a.title,
      artist: a.artist,
      approvedAt: a.updatedAt.toISOString(),
      songId: songByTitle.get(a.title.toLowerCase()) ?? null,
    })),
    archived: archived.map((a) => ({
      id: a.id,
      title: a.title,
      artist: a.artist,
      proposer: displayName(a.proposer),
    })),
  }
}

export type Board = Awaited<ReturnType<typeof getBoard>>
