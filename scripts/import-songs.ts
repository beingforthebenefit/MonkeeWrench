/**
 * Import a band's songs, charts and proposals from the JSON written by
 * scripts/drive-export-to-json.py.
 *
 *   make import BAND=<band-slug> FILE=data/import.json AS=you@example.com
 *
 * Safe to re-run while the band is still editing the old Google Docs:
 * - a new song is created with its details and chart (version 1);
 * - an existing song (matched by title) keeps its details as edited in the
 *   app, and gets a new chart version only if the Doc changed AND nobody has
 *   edited the chart in the app since the last import. Otherwise it is
 *   reported and left alone, so app edits are never overwritten.
 */
import fs from 'fs'
import {PrismaClient} from '@prisma/client'
import {importChordsOverWords} from '../src/lib/chordpro'

export const IMPORT_NOTE = 'Imported from Google Docs'

type ImportSong = {
  title: string
  writer: string | null
  leadSinger: string | null
  guitars: number | null
  keys: string | null
  percussion: string | null
  youtubeUrl: string | null
  lyricsUrl: string | null
  status: 'READY' | 'LEARNING'
  chartText: string | null
  /** Name of the Doc the chart came from (informational) */
  chartFile?: string | null
  /** History note for the imported version; defaults to IMPORT_NOTE */
  chartNote?: string | null
}
type ImportFile = {
  songs: ImportSong[]
  proposals: {title: string; artist: string}[]
}

const prisma = new PrismaClient()

async function main() {
  const [slug, file, email] = process.argv.slice(2)
  if (!slug || !file || !email) {
    console.error(
      'Usage: import-songs <band-slug> <import.json> <author email>',
    )
    process.exit(2)
  }
  const data: ImportFile = JSON.parse(fs.readFileSync(file, 'utf8'))
  const band = await prisma.band.findUniqueOrThrow({where: {slug}})

  // Imports are attributed to a real person (a member) so history reads
  // naturally
  const author = await prisma.user.findFirstOrThrow({
    where: {email, memberships: {some: {bandId: band.id}}},
  })

  const counts = {created: 0, updated: 0, unchanged: 0, skipped: 0}
  for (const s of data.songs) {
    const {chartText, chartFile: _file, chartNote, ...fields} = s
    const note = chartNote || IMPORT_NOTE
    const source = chartText
      ? importChordsOverWords(chartText, s.title).source
      : `{title: ${s.title}}\n`
    const existing = await prisma.song.findFirst({
      where: {bandId: band.id, title: {equals: s.title, mode: 'insensitive'}},
      include: {chartVersions: {orderBy: {number: 'desc'}, take: 1}},
    })

    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const song = await tx.song.create({
          data: {...fields, bandId: band.id, updatedById: author.id},
        })
        await tx.chartVersion.create({
          data: {
            songId: song.id,
            number: 1,
            source,
            authorId: author.id,
            note: chartText ? note : 'No chart yet',
          },
        })
        await tx.activity.create({
          data: {
            bandId: band.id,
            userId: author.id,
            action: 'song.import',
            targetType: 'song',
            targetId: song.id,
            summary: `imported ${song.title} from Google Docs`,
          },
        })
      })
      counts.created++
      continue
    }

    const latest = existing.chartVersions[0]
    if (!chartText || latest?.source === source) {
      counts.unchanged++
      continue
    }
    const lastWasImport =
      !latest ||
      latest.note?.startsWith('Imported from') ||
      latest.note === 'No chart yet'
    if (!lastWasImport) {
      console.warn(
        `  skipped ${s.title}: edited in the app since the last import (v${latest.number})`,
      )
      counts.skipped++
      continue
    }
    await prisma.$transaction(async (tx) => {
      await tx.chartVersion.create({
        data: {
          songId: existing.id,
          number: (latest?.number ?? 0) + 1,
          source,
          authorId: author.id,
          note,
        },
      })
      await tx.song.update({
        where: {id: existing.id},
        data: {updatedById: author.id},
      })
      await tx.activity.create({
        data: {
          bandId: band.id,
          userId: author.id,
          action: 'song.import',
          targetType: 'song',
          targetId: existing.id,
          summary: `imported a chart for ${existing.title} ${note.replace(/^Imported /, '')}`,
        },
      })
    })
    counts.updated++
  }

  let proposals = 0
  for (const p of data.proposals) {
    const exists = await prisma.proposal.findFirst({
      where: {bandId: band.id, title: {equals: p.title, mode: 'insensitive'}},
    })
    if (exists) continue
    await prisma.proposal.create({
      data: {
        bandId: band.id,
        title: p.title,
        artist: p.artist || 'Unknown',
        proposerId: author.id,
      },
    })
    proposals++
  }

  console.log(
    `songs: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.skipped} skipped; proposals: ${proposals} added`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
