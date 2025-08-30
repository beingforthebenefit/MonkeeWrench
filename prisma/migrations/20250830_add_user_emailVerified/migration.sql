-- Add columns expected by NextAuth PrismaAdapter
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
