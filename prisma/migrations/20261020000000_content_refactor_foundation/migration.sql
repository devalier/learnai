-- Expand only: nothing is dropped or rewritten, and the previous release ignores all of it.
-- IF NOT EXISTS throughout so a database that already has a piece does not fail.

-- Module tier: every existing module stays CORE until an editor decides otherwise.
ALTER TABLE "Module" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'CORE';

-- Progress basis: rows that exist now are legacy self-reported ticks. New rows get
-- SELF_REPORTED. Adding with the legacy default labels existing rows; the default is
-- then changed for rows created from here on. Re-running leaves labelled rows alone.
ALTER TABLE "Progress" ADD COLUMN IF NOT EXISTS "basis" TEXT NOT NULL DEFAULT 'LEGACY_SELF_REPORTED';
ALTER TABLE "Progress" ALTER COLUMN "basis" SET DEFAULT 'SELF_REPORTED';

CREATE TABLE IF NOT EXISTS "ContentMapping" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromKey" TEXT NOT NULL,
    "toKey" TEXT,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentMapping_kind_fromKey_key" ON "ContentMapping"("kind", "fromKey");
