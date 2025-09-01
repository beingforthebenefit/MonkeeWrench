-- Update foreign keys to cascade deletes from User
ALTER TABLE "Proposal" DROP CONSTRAINT IF EXISTS "Proposal_proposerId_fkey";
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_proposerId_fkey"
  FOREIGN KEY ("proposerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_userId_fkey";
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

