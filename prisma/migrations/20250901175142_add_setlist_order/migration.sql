-- This migration sorts BEFORE 20250901_add_setlist_order, which creates the
-- index it renames, so on a fresh database the rename used to fail and block
-- every later migration. The rename now happens only if the index exists;
-- 20250902_fix_setlist_index_rename performs it after the index is created.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.relname = 'Proposal_status_archived_setlistOrder_idx' AND c.relkind = 'i'
  ) THEN
    EXECUTE 'ALTER INDEX "Proposal_status_archived_setlistOrder_idx" RENAME TO "Proposal_status_setlistOrder_idx"';
  END IF;
END
$$;
