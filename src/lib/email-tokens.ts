import {createHash, randomBytes} from 'crypto'
import type {EmailTokenKind} from '@prisma/client'
import {prisma} from './db'
import {sendMail} from './mail'
import {PRODUCT} from './band'

/**
 * Emailed links to set a password. Starting a band, being invited and
 * forgetting a password all end the same way: a link that lets you choose
 * your own password, which also proves the address is yours.
 */

const HOUR = 60 * 60 * 1000
const LIFETIME: Record<EmailTokenKind, number> = {
  WELCOME: 7 * 24 * HOUR,
  INVITE: 7 * 24 * HOUR,
  RESET: HOUR,
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('base64url')

/** A new link for this person; their older unused links of this kind stop. */
export async function createEmailToken(
  userId: string,
  kind: EmailTokenKind,
  now = new Date(),
) {
  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.emailToken.updateMany({
      where: {userId, kind, usedAt: null},
      data: {usedAt: now},
    }),
    prisma.emailToken.create({
      data: {
        userId,
        kind,
        tokenHash: hash(token),
        expiresAt: new Date(now.getTime() + LIFETIME[kind]),
      },
    }),
  ])
  return token
}

/** The token's row if it can still be used (not used, not expired). */
export async function findEmailToken(token: string, now = new Date()) {
  if (!token) return null
  const row = await prisma.emailToken.findUnique({
    where: {tokenHash: hash(token)},
    include: {user: {select: {id: true, email: true}}},
  })
  if (!row || row.usedAt || row.expiresAt <= now) return null
  return row
}

export function setPasswordUrl(origin: string, token: string) {
  return `${origin}/set-password?token=${encodeURIComponent(token)}`
}

/** The email for each kind of link. */
export function emailFor(
  kind: EmailTokenKind,
  {
    url,
    bandName,
    by,
  }: {url: string; bandName?: string | null; by?: string | null},
) {
  switch (kind) {
    case 'WELCOME':
      return {
        subject: `Your band on ${PRODUCT}: set your password`,
        text: `${bandName ?? 'Your band'} is ready on ${PRODUCT}.

Choose your password to sign in:
${url}

Then add your bandmates on Members, and your songs on Songs. The link works once, for 7 days.

If you didn't start a band, ignore this email and nothing happens.`,
      }
    case 'INVITE':
      return {
        subject: `${by ?? 'Your band'} added you to ${bandName ?? 'a band'} on ${PRODUCT}`,
        text: `${by ?? 'An admin'} added you to ${bandName ?? 'their band'} on ${PRODUCT}: the band's charts, setlists and rehearsals, on your phone.

Choose your password to sign in:
${url}

The link works once, for 7 days. After that, use "Forgot your password?" on the sign-in page.`,
      }
    case 'RESET':
      return {
        subject: `Reset your ${PRODUCT} password`,
        text: `Choose a new password:
${url}

The link works once, for an hour. If you didn't ask for this, ignore this email; your password stays as it is.`,
      }
  }
}

/** Make a link and email it. */
export async function sendPasswordLink(opts: {
  userId: string
  email: string
  kind: EmailTokenKind
  origin: string
  bandName?: string | null
  by?: string | null
}) {
  const token = await createEmailToken(opts.userId, opts.kind)
  const url = setPasswordUrl(opts.origin, token)
  await sendMail({to: opts.email, ...emailFor(opts.kind, {url, ...opts})})
}
