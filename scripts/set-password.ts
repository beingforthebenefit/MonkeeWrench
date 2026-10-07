/**
 * Generate a new password for one member and print it once. For when nobody
 * can sign in yet (the first admin), or as an alternative to /members.
 *
 *   npx tsx scripts/set-password.ts someone@example.com
 *
 * Ends that person's existing sessions.
 */
import {PrismaClient} from '@prisma/client'
import {generatePassword, hashPassword} from '../src/lib/password'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) {
    console.error('Usage: set-password <email>')
    process.exit(2)
  }
  const user = await prisma.user.findFirst({
    where: {email: {equals: email, mode: 'insensitive'}},
  })
  if (!user) {
    console.error(
      `No member with email ${email}. Add them first (/members or import-members).`,
    )
    process.exit(1)
  }
  const password = generatePassword()
  await prisma.user.update({
    where: {id: user.id},
    data: {
      passwordHash: await hashPassword(password),
      passwordSetAt: new Date(),
      sessionVersion: {increment: 1},
    },
  })
  console.log(`${user.displayName ?? user.name ?? email}: ${password}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
