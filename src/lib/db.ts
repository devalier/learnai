import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * True when a query failed because the database schema is behind the Prisma
 * schema — a table (P2021) or column (P2022) the client expects is missing.
 *
 * This happens when code shipping new models is deployed before the schema is
 * applied to the server's database. Callers use it to degrade to an explanatory
 * message instead of a 500, so one un-migrated feature cannot take down a page.
 */
export function isSchemaOutOfDate(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
}
