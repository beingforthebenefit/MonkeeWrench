-- Personal cues: notes, pictures and notation one person pins to a chart

-- CreateEnum
CREATE TYPE "CueKind" AS ENUM ('TEXT', 'IMAGE', 'ABC');

-- CreateTable
CREATE TABLE "Cue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "anchor" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "CueKind" NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CueImage" (
    "cueId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "CueImage_pkey" PRIMARY KEY ("cueId")
);

-- CreateIndex
CREATE INDEX "Cue_userId_songId_idx" ON "Cue"("userId", "songId");

-- AddForeignKey
ALTER TABLE "Cue" ADD CONSTRAINT "Cue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cue" ADD CONSTRAINT "Cue_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CueImage" ADD CONSTRAINT "CueImage_cueId_fkey" FOREIGN KEY ("cueId") REFERENCES "Cue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

