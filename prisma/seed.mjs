import {PrismaClient, ProposalStatus} from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Local development only: a demo band with a few proposals, so a fresh dev
 * database has something on screen. Production never gets demo data (a fake
 * member would show up on Rehearsals).
 */
async function main() {
  if (process.env.APP_ENV !== 'development') return
  if (await prisma.band.count()) return

  const band = await prisma.band.create({
    data: {slug: 'demo', name: 'Demo Band', tributeTo: 'The Monkees'},
  })
  const seedUser = await prisma.user.upsert({
    where: {email: 'seed@example.com'},
    update: {},
    create: {email: 'seed@example.com', name: 'Seeder'},
  })
  await prisma.membership.create({
    data: {userId: seedUser.id, bandId: band.id, isAdmin: true},
  })

  const demo = [
    {
      title: "I'm a Believer",
      youtubeUrl: 'https://www.youtube.com/watch?v=XfuBREMXxts',
    },
    {
      title: 'Daydream Believer',
      youtubeUrl: 'https://www.youtube.com/watch?v=sUzs5dlLrm0',
    },
    {title: 'Pleasant Valley Sunday'},
    {title: 'Last Train to Clarksville'},
  ]
  const created = await Promise.all(
    demo.map((d) =>
      prisma.proposal.create({
        data: {
          ...d,
          artist: 'The Monkees',
          bandId: band.id,
          proposerId: seedUser.id,
        },
      }),
    ),
  )
  for (const p of created.slice(0, 2))
    await prisma.proposal.update({
      where: {id: p.id},
      data: {status: ProposalStatus.APPROVED},
    })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
