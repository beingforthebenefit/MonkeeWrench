import GoogleProvider from 'next-auth/providers/google'
import type {GoogleProfile} from 'next-auth/providers/google'
import {PrismaAdapter} from '@next-auth/prisma-adapter'
import {prisma} from './db'
import type {NextAuthOptions} from 'next-auth'
import type {Adapter} from 'next-auth/adapters'

function splitCsv(raw?: string) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function getSettingsAllowlistFallback() {
  return splitCsv(process.env.ADMIN_ALLOWLIST)
}

function getUserAllowlistEnv() {
  // NEW: non-admin users who are allowed to sign in
  return splitCsv(process.env.USER_ALLOWLIST)
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {strategy: 'database'},

  callbacks: {
    async signIn({account, profile}) {
      // Enforce Google-only and verified email
      if (!account || account.provider !== 'google') return false
      const gp = profile as GoogleProfile
      const email = gp?.email
      const verified = gp?.email_verified
      if (!email) return false
      if (verified === false) return false

      // Gate access: only allow emails on admin or user allowlists
      const settings = await prisma.settings.findUnique({where: {id: 1}})
      const adminAllow = settings?.adminAllowlist?.length
        ? settings.adminAllowlist
        : getSettingsAllowlistFallback()
      const userAllow = getUserAllowlistEnv()

      const isAdminEmail = adminAllow.includes(email)
      const isAllowedUser = isAdminEmail || userAllow.includes(email)
      if (!isAllowedUser) return false

      // Do NOT create users here. Return true to proceed; adapter will create/link.
      return true
    },
    async session({session}) {
      if (session.user?.email) {
        const u = await prisma.user.findUnique({
          where: {email: session.user.email},
        })
        if (u) session.user.isAdmin = u.isAdmin
      }
      return session
    },
  },

  events: {
    // Runs only when a brand new user is created by the adapter
    async createUser({user}) {
      const settings = await prisma.settings.findUnique({where: {id: 1}})
      const allow = settings?.adminAllowlist?.length
        ? settings.adminAllowlist
        : getSettingsAllowlistFallback()

      if (user.email && allow.includes(user.email)) {
        await prisma.user.update({
          where: {id: user.id},
          data: {isAdmin: true},
        })
      }
    },
  },

  // allowDangerousEmailAccountLinking: true,
}
