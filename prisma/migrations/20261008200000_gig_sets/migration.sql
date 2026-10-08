-- Gigs split into sets and breaks: set/break rows in the running order,
-- the gig's start time, and how long each song runs (for timing sets)

-- CreateEnum
CREATE TYPE "SetlistItemKind" AS ENUM ('SONG', 'SET', 'BREAK');

-- AlterTable
ALTER TABLE "Setlist" ADD COLUMN     "startTime" TEXT;

-- AlterTable
ALTER TABLE "SetlistItem" ADD COLUMN     "kind" "SetlistItemKind" NOT NULL DEFAULT 'SONG',
ADD COLUMN     "label" TEXT,
ADD COLUMN     "minutes" INTEGER,
ADD COLUMN     "startTime" TEXT,
ALTER COLUMN "songId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "seconds" INTEGER;


-- A song row must name its song; set and break rows don't
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_song_rows_have_a_song" CHECK ("kind" <> 'SONG' OR "songId" IS NOT NULL);
