/**
 * The hosted service: let a band use it for free (yours, a friend's), or
 * free until a date. Undo it by giving a date in the past: the band is then
 * read-only until someone subscribes.
 *
 *   npx tsx scripts/comp-band.ts <band slug>              # free for good
 *   npx tsx scripts/comp-band.ts <band slug> 2027-06-30   # free until then
 *
 * On the hosted server: docker exec bandstand-app npx tsx scripts/comp-band.ts …
 */
import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [slug, until] = process.argv.slice(2)
  if (!slug) {
    console.error('Usage: comp-band <band slug> [YYYY-MM-DD]')
    process.exit(2)
  }
  const date = until ? new Date(until + 'T23:59:59Z') : null
  if (date && Number.isNaN(date.getTime())) {
    console.error(`Not a date: ${until} (YYYY-MM-DD)`)
    process.exit(2)
  }
  const band = await prisma.band.findUnique({where: {slug}})
  if (!band) {
    const all = await prisma.band.findMany({select: {slug: true}})
    console.error(
      `No band "${slug}". Bands: ${all.map((b) => b.slug).join(', ')}`,
    )
    process.exit(1)
  }
  await prisma.band.update({where: {slug}, data: {paidUntil: date}})
  console.log(
    `${band.name}: ${date ? `free until ${until}` : 'free, never billed'}${band.polarSubscriptionId ? ' (it also has a Polar subscription: cancel that in Polar so they aren’t charged)' : ''}`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
