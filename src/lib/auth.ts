import CredentialsProvider from 'next-auth/providers/credentials'
import type {NextAuthOptions} from 'next-auth'
import {prisma} from './db'
import {verifyPassword} from './password'
import {clearFailures, isThrottled, recordFailure} from './login-throttle'

/**
 * Email + password sign-in. Not everyone in the band has a Google account, so
 * an admin creates each member and generates their password on /members.
 *
 * Sessions are JWTs (the credentials provider requires it). Each token
 * carries the user's sessionVersion at sign-in; resetting or changing a
 * password bumps it, which ends every older session on its next request.
 */

function clientIp(
  headers: Record<string, string | string[] | undefined> | undefined,
) {
  const h = (k: string) => {
    const v = headers?.[k]
    return Array.isArray(v) ? v[0] : v
  }
  // Behind Cloudflare and Traefik: the original client is the first hop
  return (
    h('cf-connecting-ip') ??
    h('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Password',
      credentials: {
        email: {label: 'Email', type: 'email'},
        password: {label: 'Password', type: 'password'},
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase() ?? ''
        const password = credentials?.password ?? ''
        if (!email || !password) return null
        const ip = clientIp(req?.headers as Record<string, string> | undefined)
        if (isThrottled(email, ip)) throw new Error('throttled')

        const user = await prisma.user.findFirst({
          where: {email: {equals: email, mode: 'insensitive'}},
        })
        const ok = await verifyPassword(password, user?.passwordHash)
        if (!user || !ok) {
          recordFailure(email, ip)
          return null
        }
        clearFailures(email)
        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.name,
        }
      },
    }),
  ],
  pages: {signIn: '/login', error: '/login'},
  // Long-lived: people sign in once on the phone or iPad they read charts on
  session: {strategy: 'jwt', maxAge: 180 * 24 * 60 * 60},

  callbacks: {
    async jwt({token, user}) {
      if (user) {
        const u = await prisma.user.findUnique({
          where: {id: user.id},
          select: {sessionVersion: true},
        })
        token.uid = user.id
        token.sv = u?.sessionVersion ?? 0
      }
      return token
    },
    async session({session, token}) {
      const u = token.uid
        ? await prisma.user.findUnique({
            where: {id: token.uid as string},
            select: {
              email: true,
              name: true,
              displayName: true,
              isAdmin: true,
              sessionVersion: true,
            },
          })
        : null
      // Deleted user, or password changed since this token was issued
      if (!u || u.sessionVersion !== token.sv) return {expires: session.expires}
      session.user = {
        email: u.email,
        name: u.displayName ?? u.name,
        image: null,
        isAdmin: u.isAdmin,
      }
      return session
    },
  },
}
