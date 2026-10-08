import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import type {NextAuthOptions} from 'next-auth'
import {prisma} from './db'
import {verifyPassword} from './password'
import {clearFailures, isThrottled, recordFailure} from './login-throttle'
import {avatarUrl} from './avatars'

/**
 * Email + password sign-in, plus "Sign in with Google" for members who have a
 * Google account. Either way the person must already be a member (an admin
 * adds them on /members): Google only proves who they are, it never creates
 * an account. Not everyone in the band has Google, hence the passwords.
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

function findMember(email: string) {
  return prisma.user.findFirst({
    where: {email: {equals: email.trim(), mode: 'insensitive'}},
  })
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
    // Offered only when the OAuth client is configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  pages: {signIn: '/login', error: '/login'},
  // Long-lived: people sign in once on the phone or iPad they read charts on
  session: {strategy: 'jwt', maxAge: 180 * 24 * 60 * 60},

  callbacks: {
    async signIn({account, profile}) {
      if (account?.provider !== 'google') return true
      // Google: only a verified email that belongs to a band member
      const p = profile as
        | {email?: string; email_verified?: boolean}
        | undefined
      if (!p?.email || p.email_verified === false)
        return '/login?error=NotMember'
      const member = await findMember(p.email)
      return member ? true : '/login?error=NotMember'
    },
    async jwt({token, user, account}) {
      if (user) {
        // Credentials return our user id; Google returns Google's, so map by email
        const u =
          account?.provider === 'google'
            ? await findMember(user.email ?? '')
            : await prisma.user.findUnique({where: {id: user.id}})
        if (!u) return token
        token.uid = u.id
        token.sv = u.sessionVersion
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
              sessionVersion: true,
              id: true,
              avatarAt: true,
            },
          })
        : null
      // Deleted user, or password changed since this token was issued
      if (!u || u.sessionVersion !== token.sv) return {expires: session.expires}
      session.user = {
        email: u.email,
        name: u.displayName ?? u.name,
        image: avatarUrl(u),
      }
      return session
    },
  },
}
