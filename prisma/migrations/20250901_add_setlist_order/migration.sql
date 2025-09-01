-- prisma/migrations/20250901_add_setlist_order/migration.sql
ALTER TABLE "Proposal" ADD COLUMN "setlistOrder" INTEGER;
CREATE INDEX "Proposal_status_archived_setlistOrder_idx"
  ON "Proposal" ("status", "setlistOrder");
