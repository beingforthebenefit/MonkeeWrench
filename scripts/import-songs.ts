/**
 * Import songs, charts and proposals from the JSON written by
 * scripts/drive-export-to-json.py.
 *
 *   make import FILE=data/import.json AS=you@example.com
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
}
type ImportFile = {
  songs: ImportSong[]
  proposals: {title: string; artist: string}[]
}

const prisma = new PrismaClient()

async function main() {
  const [file, email] = process.argv.slice(2)
  if (!file || !email) {
    console.error('Usage: import-songs <import.json> <author email>')
    process.exit(2)
  }
  const data: ImportFile = JSON.parse(fs.readFileSync(file, 'utf8'))

  // Imports are attributed to a real person so history reads naturally
  const author = await prisma.user.upsert({
    where: {email},
    update: {},
    create: {email, name: email.split('@')[0], isAdmin: true},
  })

  const counts = {created: 0, updated: 0, unchanged: 0, skipped: 0}
  for (const s of data.songs) {
    const {chartText, chartFile: _file, ...fields} = s
    const source = chartText
      ? importChordsOverWords(chartText, s.title).source
      : `{title: ${s.title}}\n`
    const existing = await prisma.song.findFirst({
      where: {title: {equals: s.title, mode: 'insensitive'}},
      include: {chartVersions: {orderBy: {number: 'desc'}, take: 1}},
    })

    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const song = await tx.song.create({
          data: {...fields, updatedById: author.id},
        })
        await tx.chartVersion.create({
          data: {
            songId: song.id,
            number: 1,
            source,
            authorId: author.id,
            note: chartText ? IMPORT_NOTE : 'No chart yet',
          },
        })
        await tx.activity.create({
          data: {
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
      !latest || latest.note === IMPORT_NOTE || latest.note === 'No chart yet'
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
          note: IMPORT_NOTE,
        },
      })
      await tx.song.update({
        where: {id: existing.id},
        data: {updatedById: author.id},
      })
      await tx.activity.create({
        data: {
          userId: author.id,
          action: 'song.import',
          targetType: 'song',
          targetId: existing.id,
          summary: `re-imported ${existing.title} from Google Docs`,
        },
      })
    })
    counts.updated++
  }

  let proposals = 0
  for (const p of data.proposals) {
    const exists = await prisma.proposal.findFirst({
      where: {title: {equals: p.title, mode: 'insensitive'}},
    })
    if (exists) continue
    await prisma.proposal.create({
      data: {
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
