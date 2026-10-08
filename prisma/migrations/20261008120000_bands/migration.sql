-- One install, several bands. Everything that belongs to a band gets a
-- bandId; people join bands through Membership, and "admin" becomes a role
-- in a band. An install that already has data gets one band holding all of
-- it, which the owner renames from the app.

CREATE TABLE "Band" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appName" TEXT NOT NULL DEFAULT 'Bandstand',
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "chatUrl" TEXT,
    "tributeTo" TEXT,
    "voteThreshold" INTEGER NOT NULL DEFAULT 2,
    "iconAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Band_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Band_slug_key" ON "Band"("slug");

CREATE TABLE "BandIcon" (
    "bandId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BandIcon_pkey" PRIMARY KEY ("bandId")
);

CREATE TABLE "BandDomain" (
    "host" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    CONSTRAINT "BandDomain_pkey" PRIMARY KEY ("host")
);

CREATE TABLE "Membership" (
    "userId" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","bandId")
);
CREATE INDEX "Membership_bandId_idx" ON "Membership"("bandId");

-- Existing data: one band, carrying the old vote threshold
INSERT INTO "Band" ("id", "slug", "name", "voteThreshold")
SELECT 'band-first', 'band', 'My band',
       COALESCE((SELECT "voteThreshold" FROM "Settings" WHERE "id" = 1), 2)
WHERE EXISTS (SELECT 1 FROM "User") OR EXISTS (SELECT 1 FROM "Song");

-- Everyone is in it; the old admins are its admins
INSERT INTO "Membership" ("userId", "bandId", "isAdmin")
SELECT "id", 'band-first', "isAdmin" FROM "User"
WHERE EXISTS (SELECT 1 FROM "Band" WHERE "id" = 'band-first');

-- The longest-standing admin runs the install
ALTER TABLE "User" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "isOwner" = true WHERE "id" = (
  SELECT "id" FROM "User" WHERE "isAdmin" ORDER BY "createdAt", "id" LIMIT 1
);
ALTER TABLE "User" DROP COLUMN "isAdmin",
ADD COLUMN "blockOtherBands" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "shareAvailability" BOOLEAN NOT NULL DEFAULT true;

-- Band-owned rows
ALTER TABLE "Song" ADD COLUMN "bandId" TEXT;
ALTER TABLE "Setlist" ADD COLUMN "bandId" TEXT;
ALTER TABLE "Rehearsal" ADD COLUMN "bandId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "bandId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "bandId" TEXT;
UPDATE "Song" SET "bandId" = 'band-first';
UPDATE "Setlist" SET "bandId" = 'band-first';
UPDATE "Rehearsal" SET "bandId" = 'band-first';
UPDATE "Proposal" SET "bandId" = 'band-first';
-- Personal changes stay band-less: they show in every band the person is in
UPDATE "Activity" SET "bandId" = 'band-first'
WHERE "targetType" NOT IN ('availability')
  AND "action" NOT IN ('account.password', 'user.avatar');
ALTER TABLE "Song" ALTER COLUMN "bandId" SET NOT NULL;
ALTER TABLE "Setlist" ALTER COLUMN "bandId" SET NOT NULL;
ALTER TABLE "Rehearsal" ALTER COLUMN "bandId" SET NOT NULL;
ALTER TABLE "Proposal" ALTER COLUMN "bandId" SET NOT NULL;

DROP INDEX "Activity_createdAt_idx";
DROP INDEX "Proposal_status_setlistOrder_idx";
DROP INDEX "Rehearsal_date_idx";
DROP INDEX "Song_title_idx";
CREATE INDEX "Activity_bandId_createdAt_idx" ON "Activity"("bandId", "createdAt");
CREATE INDEX "Proposal_bandId_status_idx" ON "Proposal"("bandId", "status");
CREATE INDEX "Rehearsal_bandId_date_idx" ON "Rehearsal"("bandId", "date");
CREATE INDEX "Setlist_bandId_idx" ON "Setlist"("bandId");
CREATE INDEX "Song_bandId_title_idx" ON "Song"("bandId", "title");

-- Availability: "" = shared by all the person's bands (the default)
DROP INDEX "Unavailability_userId_date_key";
ALTER TABLE "Unavailability" ADD COLUMN "scope" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "Unavailability_userId_scope_date_key" ON "Unavailability"("userId", "scope", "date");

-- The vote threshold now lives on the band
DROP TABLE "Settings";

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Song" ADD CONSTRAINT "Song_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Setlist" ADD CONSTRAINT "Setlist_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BandIcon" ADD CONSTRAINT "BandIcon_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BandDomain" ADD CONSTRAINT "BandDomain_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
