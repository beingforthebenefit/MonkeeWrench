/**
 * Add members to a band and import availability from its old sheet.
 *
 *   npx tsx scripts/import-members.ts <band-slug> data/members.json data/import.json
 *
 * members.json: {members: [{name, displayName, email, isAdmin?}]} -- kept in
 * gitignored data/ (personal emails; the repo is public).
 * import.json: written by drive-export-to-json.py; its `availability` holds
 * the sheet's marks by column name, matched to displayName.
 *
 * Never creates or changes passwords: an admin generates those on /members
 * (or with scripts/set-password.ts) when they are ready to send them.
 * Availability is imported only for a member who has not yet marked anything
 * in the app, so re-running never overwrites what someone entered themselves.
 */
import fs from 'fs'
import {PrismaClient, type UnavailableKind} from '@prisma/client'

type MemberIn = {
  name: string
  displayName: string
  email: string
  isAdmin?: boolean
}
type Avail = {
  members: string[]
  answered: string[]
  entries: {name: string; date: string; kind: UnavailableKind}[]
}

const prisma = new PrismaClient()

async function main() {
  const [slug, membersFile, importFile] = process.argv.slice(2)
  if (!slug || !membersFile) {
    console.error(
      'Usage: import-members <band-slug> <members.json> [import.json]',
    )
    process.exit(2)
  }
  const band = await prisma.band.findUniqueOrThrow({where: {slug}})
  const {members}: {members: MemberIn[]} = JSON.parse(
    fs.readFileSync(membersFile, 'utf8'),
  )
  const byName = new Map<string, string>()

  for (const m of members) {
    const email = m.email.trim().toLowerCase()
    const existing = await prisma.user.findFirst({
      where: {email: {equals: email, mode: 'insensitive'}},
    })
    const user = existing
      ? await prisma.user.update({
          where: {id: existing.id},
          data: {email, name: m.name, displayName: m.displayName},
        })
      : await prisma.user.create({
          data: {email, name: m.name, displayName: m.displayName},
        })
    await prisma.membership.upsert({
      where: {userId_bandId: {userId: user.id, bandId: band.id}},
      create: {userId: user.id, bandId: band.id, isAdmin: Boolean(m.isAdmin)},
      update: m.isAdmin ? {isAdmin: true} : {},
    })
    byName.set(m.displayName.toLowerCase(), user.id)
    console.log(
      `${existing ? 'updated' : 'added  '} ${m.displayName.padEnd(10)} ${email}${user.passwordHash ? '' : '  (no password yet)'}`,
    )
  }

  if (!importFile) return
  const avail: Avail | null = JSON.parse(
    fs.readFileSync(importFile, 'utf8'),
  ).availability
  if (!avail) return console.log('no availability in', importFile)

  for (const name of avail.members) {
    const userId = byName.get(name.toLowerCase())
    if (!userId) {
      console.warn(
        `  availability column "${name}" matches no member's displayName -- skipped`,
      )
      continue
    }
    const user = await prisma.user.findUniqueOrThrow({where: {id: userId}})
    if (user.availabilityUpdatedAt) {
      console.log(
        `  ${name}: already marked their days in the app -- left alone`,
      )
      continue
    }
    const rows = avail.entries.filter((e) => e.name === name)
    await prisma.$transaction(async (tx) => {
      for (const e of rows) {
        const date = new Date(e.date + 'T00:00:00Z')
        // Into their shared days (scope ""), which every band sees
        await tx.unavailability.upsert({
          where: {userId_scope_date: {userId, scope: '', date}},
          create: {userId, scope: '', date, kind: e.kind},
          update: {kind: e.kind},
        })
      }
      // Only someone who marked at least one day in the sheet has "answered":
      // a blank column can't be told apart from not having filled it in
      if (avail.answered.includes(name))
        await tx.user.update({
          where: {id: userId},
          data: {availabilityUpdatedAt: new Date()},
        })
    })
    console.log(
      `  ${name}: ${rows.length} days imported${avail.answered.includes(name) ? '' : ' (no marks: shown as not answered)'}`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
