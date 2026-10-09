-- When someone finished (or skipped) the first-time tour; null = show it
ALTER TABLE "User" ADD COLUMN "tourDoneAt" TIMESTAMP(3);
