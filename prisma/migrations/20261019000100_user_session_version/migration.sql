-- Sessions can be revoked: a token carries the version it was issued at (User.sessionVersion).
--
-- IF NOT EXISTS because the column may already be there: it was added to some databases by
-- `prisma db push` before migrations were introduced. Adding it twice must not fail.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
