#!/usr/bin/env bash
# One-time step for a database that was built with `prisma db push` and so has the tables
# but no migration history. It checks that the database really is what the baseline
# migration describes, then records the baseline as already applied. Run it BEFORE the first
# `npm run build` of a release that uses migrations (the build runs `prisma migrate deploy`,
# which refuses a non-empty database with no history: error P3005).
#
#   DATABASE_URL=... ./scripts/db-baseline.sh
#
# Safe to run twice. It changes nothing but the `_prisma_migrations` bookkeeping table.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
: "${DATABASE_URL:?DATABASE_URL is not set}"

BASELINE="20261019000000_baseline"

has_history=$(psql "$DATABASE_URL" -tAc "select to_regclass('public._prisma_migrations') is not null" 2>/dev/null || echo "error")
[ "$has_history" = "error" ] && { echo "cannot connect to the database"; exit 2; }
if [ "$has_history" = "t" ]; then echo "This database already has a migration history. Nothing to do."; exit 0; fi

has_tables=$(psql "$DATABASE_URL" -tAc "select to_regclass('public.\"User\"') is not null")
if [ "$has_tables" != "t" ]; then
  echo "This database is empty. Do not baseline it: 'npm run build' (prisma migrate deploy) will create everything."
  exit 0
fi

# What differs between this database and the schema in the repository? The only difference
# a database built before migrations may have is the session-version column, which the
# next migration adds. Anything else means the database is not what this release expects.
diff_out=$(npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null || true)
expected='ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;'
stripped=$(echo "$diff_out" | grep -v '^-- ' | grep -v '^[[:space:]]*$' || true)
if [ -n "$stripped" ] && [ "$stripped" != "$expected" ]; then
  echo "The database differs from the schema this release expects, beyond the known session-version column:"
  echo "$diff_out"
  echo
  echo "Not baselining. Find out why (a manual change? an older or newer build?), restore from backup or"
  echo "correct it, and run this again."
  exit 1
fi

echo "The database matches the baseline. Recording it as applied: $BASELINE"
npx prisma migrate resolve --applied "$BASELINE"
echo "Done. Now build as usual: 'npm run build' applies any later migrations."
