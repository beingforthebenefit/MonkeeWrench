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
  allowDangerousEmailAccountLinking: true,

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
      // Merge DB and env allowlists so either source grants access
      const adminAllow = Array.from(
        new Set([
          ...(settings?.adminAllowlist ?? []),
          ...getSettingsAllowlistFallback(),
        ]),
      )
      const userAllow = getUserAllowlistEnv()

      const existingUser = await prisma.user.findUnique({
        where: {email},
        select: {id: true},
      })

      const isAdminEmail = adminAllow.includes(email)
      const isAllowedUser =
        Boolean(existingUser) || isAdminEmail || userAllow.includes(email)
      if (!isAllowedUser) return false

      // Attempt to pre-link Google account to existing user by email to avoid
      // OAuthAccountNotLinked when the user already exists without a linked account.
      try {
        const provider = account.provider
        const providerAccountId = account.providerAccountId
        const existingAccount = await prisma.account.findUnique({
          where: {provider_providerAccountId: {provider, providerAccountId}},
          select: {id: true},
        })
        if (!existingAccount) {
          if (existingUser) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider,
                providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at ?? undefined,
                token_type: account.token_type ?? undefined,
                scope: account.scope ?? undefined,
                id_token: account.id_token ?? undefined,
                // Some providers add non-standard fields like `session_state`.
                // Safely extract a string value if present without using `any`.
                session_state:
                  typeof (account as Record<string, unknown>)?.[
                    'session_state'
                  ] === 'string'
                    ? ((account as Record<string, unknown>)[
                        'session_state'
                      ] as string)
                    : undefined,
              },
            })
          }
        }
      } catch {
        // Best-effort link; ignore failures and let NextAuth handle.
      }

      // Best-effort: sync basic profile fields onto the user
      try {
        const name = gp?.name as string | undefined
        const picture = gp?.picture as string | undefined
        if (existingUser && (name || picture)) {
          await prisma.user.update({
            where: {id: existingUser.id},
            data: {
              ...(name ? {name} : {}),
              ...(picture ? {image: picture} : {}),
            },
          })
        }
      } catch {
        // ignore
      }

      // Do NOT create users here. Return true to proceed; adapter will create/link.
      return true
    },
    async session({session}) {
      if (session.user?.email) {
        const u = await prisma.user.findUnique({
          where: {email: session.user.email},
          select: {isAdmin: true, image: true, name: true},
        })
        if (u) {
          session.user.isAdmin = u.isAdmin
          // Ensure image and name are present on the session
          if (u.image) session.user.image = u.image
          if (u.name) session.user.name = u.name
        }
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
    // Keep the user's profile image in sync with Google on sign-in
    async signIn({user, profile, account}) {
      try {
        if (account?.provider === 'google') {
          const gp = profile as GoogleProfile | undefined
          const googleImage = gp?.picture as string | undefined
          if (user?.id && googleImage) {
            const existing = await prisma.user.findUnique({
              where: {id: user.id},
              select: {image: true},
            })
            if (!existing?.image || existing.image !== googleImage) {
              await prisma.user.update({
                where: {id: user.id},
                data: {image: googleImage},
              })
            }
          }
        }
      } catch {
        // Best-effort sync; ignore failures
      }
    },
  },

  // allowDangerousEmailAccountLinking: true,
}
