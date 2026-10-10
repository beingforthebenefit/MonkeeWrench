import {createHash, randomBytes} from 'crypto'
import type {EmailTokenKind} from '@prisma/client'
import {prisma} from './db'
import {sendMail} from './mail'
import {PRODUCT} from './band'
import {renderEmail} from './email-layout'

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

/** The email for each kind of link: subject, HTML and plain text. */
export function emailFor(
  kind: EmailTokenKind,
  {
    url,
    origin,
    bandName,
    by,
  }: {
    url: string
    origin: string
    bandName?: string | null
    by?: string | null
  },
) {
  switch (kind) {
    case 'WELCOME':
      return {
        subject: `${bandName ?? 'Your band'} is ready on ${PRODUCT}`,
        ...renderEmail(
          {
            heading: `${bandName ?? 'Your band'} is ready`,
            paragraphs: [
              'Choose a password and you’re in. Two sample songs are waiting so you can try things out: change the key, tap a chord, open the horn line.',
              'Then add your bandmates on Members (each gets an email like this one), and your own songs on Songs.',
            ],
            button: {label: 'Choose your password', url},
            after: ['The link works once, for 7 days.'],
            footer: `You started a band on ${PRODUCT}. If that wasn’t you, ignore this email and nothing happens.`,
          },
          origin,
        ),
      }
    case 'INVITE':
      return {
        subject: `${by ?? 'Your band'} added you to ${bandName ?? 'a band'} on ${PRODUCT}`,
        ...renderEmail(
          {
            heading: `You’re in ${bandName ?? 'the band'}`,
            paragraphs: [
              `${by ?? 'An admin'} added you to ${bandName ?? 'their band'} on ${PRODUCT}: the band’s charts in any key, the setlists, and when rehearsals are, on your phone.`,
            ],
            button: {label: 'Choose your password', url},
            after: [
              'The link works once, for 7 days. After that, use “Forgot your password?” on the sign-in page.',
            ],
            footer: `${by ?? 'A band admin'} added this address to ${bandName ?? 'a band'} on ${PRODUCT}.`,
          },
          origin,
        ),
      }
    case 'RESET':
      return {
        subject: `Reset your ${PRODUCT} password`,
        ...renderEmail(
          {
            heading: 'Choose a new password',
            paragraphs: [
              'Someone, probably you, asked to reset your password.',
            ],
            button: {label: 'Choose a new password', url},
            after: ['The link works once, for an hour.'],
            footer:
              'If you didn’t ask for this, ignore this email; your password stays as it is.',
          },
          origin,
        ),
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
