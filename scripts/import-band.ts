/**
 * Load a band's songs, charts, setlists and rehearsals from one JSON file
 * (for moving a band in from OnSong, a spreadsheet, another app...).
 *
 *   npx tsx scripts/import-band.ts band.json
 *
 * {
 *   "band": "band-slug",             // must exist (start it in the app)
 *   "as": "you@example.com",         // a member: the import is credited to them
 *   "songs": [{
 *     "title": "...", "writer"?, "leadSinger"?, "seconds"?, "youtubeUrl"?,
 *     "notes"?, "status"?: "READY" | "LEARNING",
 *     "chart"?: {"onsong": {"title", "byline"?, "key"?, "content"}}
 *            | {"chordpro": "..."} | {"text": "chords above the words"},
 *     "cues"?: [{"kind": "TEXT" | "ABC", "text": "...", "anchor"?: ""}]
 *   }],
 *   "setlists"?: [{
 *     "name", "gigDate"?: "2026-10-17", "startTime"?: "13:30", "venue"?,
 *     "notes"?, "items": [{"song": "title", "key"?, "note"?}
 *                         | {"set": "Set 1", "minutes"?} | {"break": 15}]
 *   }],
 *   "rehearsals"?: [{"date": "2026-10-12", "time"?, "place"?, "note"?}]
 * }
 *
 * The same import as the app's Import page (src/lib/band-import.ts), which
 * is easier for most: this is for a file you've already built.
 *
 * Safe to re-run: songs are matched by title within the band (an existing
 * one is left alone), cues are added once, setlists and rehearsals that
 * already exist (same name / same date) are skipped. An OnSong chart's
 * player notes on top ("Piano - Light and airy") become a personal cue for
 * "as" rather than part of everyone's chart.
 */
import fs from 'fs'
import {PrismaClient} from '@prisma/client'
import {BandImport} from '../src/lib/band-import-schema'
import {importBand} from '../src/lib/band-import'

const prisma = new PrismaClient()

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: import-band <band.json>')
    process.exit(2)
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const data = BandImport.parse(raw)
  const band = await prisma.band.findUniqueOrThrow({where: {slug: raw.band}})
  const me = await prisma.user.findFirstOrThrow({
    where: {
      email: {equals: raw.as, mode: 'insensitive'},
      memberships: {some: {bandId: band.id}},
    },
  })
  const r = await importBand(data, {bandId: band.id, userId: me.id}, prisma)
  console.log(
    `${band.name}: ${r.songsAdded} songs added (${r.songsThere} already there), ${r.cues} cues, ${r.setlistsAdded} setlists, ${r.rehearsalsAdded} rehearsals`,
  )
  if (r.missing.length)
    console.log(
      `Not in the band, left out of setlists: ${r.missing.join(', ')}`,
    )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
