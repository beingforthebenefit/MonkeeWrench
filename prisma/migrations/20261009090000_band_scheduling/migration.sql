-- A band can turn rehearsal scheduling off: no Rehearsals tab, page or API
ALTER TABLE "Band" ADD COLUMN "scheduling" BOOLEAN NOT NULL DEFAULT true;
