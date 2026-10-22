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

# What differs between this database and the schema that existed when it was built with
# `db push`? That schema is the baseline migration plus the session-version migration, NOT
# the current schema.prisma: later migrations add columns and tables on purpose, and
# `migrate deploy` applies them after this step. Comparing against the current schema would
# refuse every legacy database as soon as a later migration exists.
#
# The comparison needs a scratch ("shadow") database on the same server, created and dropped
# here; the role in DATABASE_URL needs CREATEDB. The only difference a legacy database may
# have is the missing session-version column, which that migration adds.
KNOWN="20261019000000_baseline 20261019000100_user_session_version"
tmp=$(mktemp -d)
shadow="learnai_shadow_$$"
cleanup() { psql "$DATABASE_URL" -qc "drop database if exists \"$shadow\"" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
cp prisma/migrations/migration_lock.toml "$tmp/"
for m in $KNOWN; do cp -r "prisma/migrations/$m" "$tmp/"; done
psql "$DATABASE_URL" -qc "create database \"$shadow\"" || { echo "Cannot create a scratch database: the role needs CREATEDB (or use the owner role)."; exit 2; }
shadow_url=$(node -e 'const u=new URL(process.argv[1]); u.pathname="/"+process.argv[2]; console.log(u.toString())' "$DATABASE_URL" "$shadow")
diff_out=$(npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations "$tmp" --shadow-database-url "$shadow_url" --script 2>/dev/null || true)
expected='ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;'
stripped=$(echo "$diff_out" | sed 's/"public"\.//g' | grep -v '^-- ' | grep -v '^[[:space:]]*$' || true)
if [ -n "$stripped" ] && [ "$stripped" != "$expected" ]; then
  echo "The database differs from the schema it should have been built from, beyond the known session-version column:"
  echo "$diff_out"
  echo
  echo "Not baselining. Find out why (a manual change? an older or newer build?), restore from backup or"
  echo "correct it, and run this again."
  exit 1
fi

echo "The database matches the baseline. Recording it as applied: $BASELINE"
npx prisma migrate resolve --applied "$BASELINE"
echo "Done. Now build as usual: 'npm run build' applies any later migrations."
