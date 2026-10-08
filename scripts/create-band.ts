/**
 * Start a band from the command line: for a fresh install (nobody can sign
 * in yet), or any time. Creates the band and its first admin, who also
 * becomes the install owner if there isn't one.
 *
 *   npx tsx scripts/create-band.ts "Band Name" you@example.com "Your Name"
 *   npx tsx scripts/set-password.ts you@example.com   # then sign in
 *
 * After that, bands are started from the app (menu → All bands).
 */
import {PrismaClient} from '@prisma/client'
import {slugify} from '../src/lib/band-fields'

const prisma = new PrismaClient()

async function main() {
  const [name, rawEmail, person] = process.argv.slice(2)
  const email = rawEmail?.trim().toLowerCase()
  if (!name || !email) {
    console.error(
      'Usage: create-band "<band name>" <admin email> ["<their name>"]',
    )
    process.exit(2)
  }
  const base = slugify(name)
  let slug = base
  for (let n = 2; await prisma.band.findUnique({where: {slug}}); n++)
    slug = `${base}-${n}`
  const hasOwner = (await prisma.user.count({where: {isOwner: true}})) > 0
  const user =
    (await prisma.user.findFirst({
      where: {email: {equals: email, mode: 'insensitive'}},
    })) ??
    (await prisma.user.create({
      data: {
        email,
        name: person ?? null,
        displayName: person?.split(' ')[0] ?? null,
      },
    }))
  if (!hasOwner)
    await prisma.user.update({where: {id: user.id}, data: {isOwner: true}})
  const band = await prisma.band.create({data: {name, slug}})
  await prisma.membership.create({
    data: {userId: user.id, bandId: band.id, isAdmin: true},
  })
  console.log(
    `${name} (${slug}): admin ${email}${hasOwner ? '' : ', who now runs this install'}${user.passwordHash ? '' : '. No password yet: run scripts/set-password.ts'}`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
