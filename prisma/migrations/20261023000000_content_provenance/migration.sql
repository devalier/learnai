-- Expand only. Records who owns each content row so the seed can stop overwriting and
-- deleting what admins and users have added or changed. The previous release ignores all of it.
-- Existing rows default to origin 'ADMIN' (protected); the one-time adopt step (npm run content:adopt)
-- marks the rows that match the seed as 'SEED' and records the values the seed last wrote.
-- IF NOT EXISTS throughout so a database that already has a piece does not fail.
ALTER TABLE "Course"   ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Course"   ADD COLUMN IF NOT EXISTS "seedSnapshot" JSONB;
ALTER TABLE "Section"  ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Section"  ADD COLUMN IF NOT EXISTS "seedSnapshot" JSONB;
ALTER TABLE "Section"  ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Module"   ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Module"   ADD COLUMN IF NOT EXISTS "seedSnapshot" JSONB;
ALTER TABLE "Module"   ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP(3);
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "seedSnapshot" JSONB;
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP(3);
ALTER TABLE "Region"   ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Region"   ADD COLUMN IF NOT EXISTS "seedSnapshot" JSONB;
ALTER TABLE "Edge"     ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Edge"     ADD COLUMN IF NOT EXISTS "seedSnapshot" JSONB;
ALTER TABLE "Node"     ADD COLUMN IF NOT EXISTS "seedSnapshot" JSONB;

CREATE TABLE IF NOT EXISTS "ContentConflict" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "adminValue" JSONB,
    "seedValue" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "ContentConflict_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentConflict_kind_key_field_key" ON "ContentConflict"("kind", "key", "field");
