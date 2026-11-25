-- Expand only: a new table the previous release never reads.
-- IF NOT EXISTS so a database that already has it does not fail.
CREATE TABLE IF NOT EXISTS "AiSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL DEFAULT '',
    "keyCiphertext" TEXT,
    "keyHint" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AiSetting_pkey" PRIMARY KEY ("id")
);
