-- Safe follow-up: ensure the setlist index has the final name.
-- If the old-named index exists, rename it; otherwise do nothing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Proposal_status_archived_setlistOrder_idx'
      AND c.relkind = 'i'
  ) THEN
    EXECUTE 'ALTER INDEX "Proposal_status_archived_setlistOrder_idx" RENAME TO "Proposal_status_setlistOrder_idx"';
  END IF;
END
$$;
