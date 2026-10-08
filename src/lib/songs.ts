import type {Prisma, PrismaClient} from '@prisma/client'
import {prisma} from './db'

type Tx = Prisma.TransactionClient | PrismaClient

export class ConflictError extends Error {
  constructor(public latest: number) {
    super(`Chart was changed by someone else (now version ${latest})`)
  }
}

export async function logActivity(
  tx: Tx,
  data: {
    userId: string | null
    action: string
    targetType: string
    targetId?: string | null
    summary: string
  },
) {
  await tx.activity.create({data})
}

async function latestNumber(tx: Tx, songId: string) {
  const last = await tx.chartVersion.findFirst({
    where: {songId},
    orderBy: {number: 'desc'},
    select: {number: true},
  })
  return last?.number ?? 0
}

/**
 * Save a new chart version. `baseNumber` is the version the editor started
 * from; if someone saved in the meantime the save is refused rather than
 * silently overwriting their change.
 */
export async function saveChart(args: {
  songId: string
  userId: string
  source: string
  note?: string | null
  baseNumber: number
  restoredFrom?: number | null
}) {
  return prisma.$transaction(async (tx) => {
    const latest = await latestNumber(tx, args.songId)
    if (args.baseNumber !== latest) throw new ConflictError(latest)
    const number = latest + 1
    const version = await tx.chartVersion.create({
      data: {
        songId: args.songId,
        number,
        source: args.source,
        note: args.note?.trim() || null,
        authorId: args.userId,
        restoredFrom: args.restoredFrom ?? null,
      },
    })
    const song = await tx.song.update({
      where: {id: args.songId},
      data: {updatedById: args.userId},
      select: {title: true},
    })
    await logActivity(tx, {
      userId: args.userId,
      action: args.restoredFrom ? 'chart.restore' : 'chart.save',
      targetType: 'song',
      targetId: args.songId,
      summary: args.restoredFrom
        ? `restored ${song.title} to version ${args.restoredFrom}`
        : `edited the chart for ${song.title}${args.note?.trim() ? ` — “${args.note.trim()}”` : ''}`,
    })
    return version
  })
}

export async function restoreVersion(args: {
  songId: string
  number: number
  userId: string
}) {
  const old = await prisma.chartVersion.findUnique({
    where: {songId_number: {songId: args.songId, number: args.number}},
  })
  if (!old) return null
  const latest = await latestNumber(prisma, args.songId)
  return saveChart({
    songId: args.songId,
    userId: args.userId,
    source: old.source,
    note: `Restored version ${args.number}`,
    baseNumber: latest,
    restoredFrom: args.number,
  })
}

const authorSelect = {
  select: {
    id: true,
    name: true,
    displayName: true,
    email: true,
    avatarAt: true,
  },
} as const

/** Songs with their latest chart version's number, author and date. */
export async function listSongs() {
  const songs = await prisma.song.findMany({
    orderBy: [{status: 'asc'}, {title: 'asc'}],
    include: {
      chartVersions: {
        orderBy: {number: 'desc'},
        take: 1,
        select: {
          number: true,
          createdAt: true,
          note: true,
          author: authorSelect,
          source: true,
        },
      },
    },
  })
  return songs.map(({chartVersions, ...s}) => ({
    ...s,
    latest: chartVersions[0] ?? null,
  }))
}

export async function getSong(id: string) {
  const song = await prisma.song.findUnique({
    where: {id},
    include: {
      chartVersions: {
        orderBy: {number: 'desc'},
        take: 1,
        include: {author: authorSelect},
      },
    },
  })
  if (!song) return null
  const {chartVersions, ...rest} = song
  return {...rest, latest: chartVersions[0] ?? null}
}

export async function listVersions(songId: string) {
  return prisma.chartVersion.findMany({
    where: {songId},
    orderBy: {number: 'desc'},
    include: {author: authorSelect},
  })
}

export function displayName(
  u: {
    name: string | null
    email: string | null
    displayName?: string | null
  } | null,
) {
  if (!u) return 'someone'
  // What the band calls them ("Ken"), else the first name, else the email
  if (u.displayName) return u.displayName
  if (u.name) return u.name.split(' ')[0]
  const local = u.email?.split('@')[0]
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'someone'
}

/**
 * A proposal that wins the vote joins the book as a song to learn, with an
 * empty chart for someone to fill in. No-op if the song is already there.
 */
export async function addSongFromProposal(
  tx: Tx,
  p: {
    title: string
    artist: string
    youtubeUrl: string | null
    lyricsUrl: string | null
  },
  userId: string,
) {
  const exists = await tx.song.findFirst({
    where: {title: {equals: p.title, mode: 'insensitive'}},
    select: {id: true},
  })
  if (exists) return null
  const song = await tx.song.create({
    data: {
      title: p.title,
      notes:
        p.artist && p.artist !== 'The Monkees'
          ? `Originally by ${p.artist}`
          : null,
      youtubeUrl: p.youtubeUrl,
      lyricsUrl: p.lyricsUrl,
      status: 'LEARNING',
      updatedById: userId,
    },
  })
  await tx.chartVersion.create({
    data: {
      songId: song.id,
      number: 1,
      source: `{title: ${p.title}}\n`,
      authorId: userId,
      note: 'No chart yet',
    },
  })
  await logActivity(tx, {
    userId,
    action: 'song.create',
    targetType: 'song',
    targetId: song.id,
    summary: `voted ${p.title} in — it's on the list to learn`,
  })
  return song
}

/** A version written by the importer (or the empty placeholder), not by a person editing. */
export function isImportNote(note: string | null | undefined) {
  return Boolean(
    note &&
      (note.startsWith('Imported from') ||
        note === 'No chart yet' ||
        note === 'Created'),
  )
}
