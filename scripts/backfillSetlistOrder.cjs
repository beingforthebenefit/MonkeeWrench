// Backfill setlistOrder for approved proposals
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const approved = await prisma.proposal.findMany({
      where: { status: 'APPROVED' },
      orderBy: [{ updatedAt: 'desc' }],
      select: { id: true },
    })

    await prisma.$transaction(
      approved.map((p, i) =>
        prisma.proposal.update({
          where: { id: p.id },
          data: { setlistOrder: i + 1 },
        })
      )
    )

    console.log(`Backfilled ${approved.length} rows`)
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
})()
