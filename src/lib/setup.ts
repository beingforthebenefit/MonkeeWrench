import {prisma} from './db'

/** A fresh install: nobody has an account yet, so /setup makes the first. */
export async function needsSetup() {
  return (await prisma.user.count()) === 0
}
