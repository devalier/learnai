-- Expand only: a new table, used only when a learner chooses to save a worksheet to their account.
-- IF NOT EXISTS so a database that already has it does not fail.
CREATE TABLE IF NOT EXISTS "WorksheetEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "days" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorksheetEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorksheetEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorksheetEntry_userId_exerciseCode_key" ON "WorksheetEntry"("userId", "exerciseCode");
