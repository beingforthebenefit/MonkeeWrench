import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";
import type { NextAuthOptions } from "next-auth";

function getSettingsAllowlistFallback() {
  const raw = (process.env.ADMIN_ALLOWLIST || "").split(",").map(s => s.trim()).filter(Boolean);
  return raw;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  session: { strategy: "database" },
  callbacks: {
    async signIn({ account, profile }) {
      // Enforce Google-only
      if (!account || account.provider !== "google") return false;
      // If first login & on allowlist, mark admin
      const email = (profile?.email as string) || "";
      if (!email) return false;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        const allow = settings?.adminAllowlist?.length ? settings.adminAllowlist : getSettingsAllowlistFallback();
        if (allow.includes(email)) {
          await prisma.user.upsert({
            where: { email },
            update: { isAdmin: true },
            create: { email, isAdmin: true }
          });
        }
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const u = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (u) (session.user as any).isAdmin = u.isAdmin;
      }
      return session;
    }
  }
};