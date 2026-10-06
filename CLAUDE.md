# learnai — working rules

## Dependencies: non-negotiable

This repository was compromised once through a dependency with a published
remote-code-execution advisory, within minutes of deploying. A second critical
advisory then sat in the lockfile for thirteen days because a change was
shipped with a "Verification" section that did not include an audit.

Both failures were the same failure: checking that the code works, and calling
that verified.

**`npm audit` is part of "it builds". A change is not verified until the audit
is clean.**

Specifically:

1. **Run `npm run audit:ci` before every push.** Not before the first push of a
   branch — before every push. Advisories are published continuously and the
   clean result from last week says nothing about today.
2. **Audit the lockfile, never the manifest.** A caret range in `package.json`
   is not protection. `"next": "^16.3.5"` resolves to 16.3.5 forever once it is
   locked, and `package-lock.json` is what deploys. Read the resolved version:
   `node -e 'const l=require("./package-lock.json");console.log(l.packages["node_modules/next"].version)'`
3. **Never write "verified" in a PR description without an audit line in it.**
   If the audit was not run, do not claim verification — say what was and was
   not checked.
4. **A high or critical advisory blocks the push.** Patch it, or say plainly
   that it is unpatched and why, before pushing. Never both ship and stay quiet.
5. **Take the current patch release**, not merely the first version that clears
   the advisory — 16.3.8 over 16.3.6 — while staying inside the same minor.
6. **A transitive advisory is still yours.** `source-map-js` arrived through
   `postcss`, and `sharp` through `next`. Neither is declared here. Both are
   still ours to override.
7. **A clean audit goes stale.** The `sharp` advisory was published between a
   clean `audit:ci` and the next command in the same session — minutes, with
   nothing in the repo changing. So re-run the audit immediately before the
   push, not at the start of the work, and re-run it again before merging a
   branch that has been open for more than a day. The daily CI job exists
   because neither of those catches an advisory published after the merge.

Dependabot is deliberately disabled here: it auto-merged breaking majors
(Prisma 7, a `@types/bcryptjs` stub) and broke the build. The daily audit job
in `.github/workflows/ci.yml` replaces the part of its job that mattered. Do
not re-enable Dependabot without asking; do not remove the daily audit.

## Gates

- `npm run audit:ci` — fails on high or above.
- `npx tsc --noEmit`
- `npm run build` — note this runs `prisma db push`, so it needs a reachable
  `DATABASE_URL`, at build time as well as run time.

CI runs all three on every push and pull request, and the audit again daily on
a schedule — because the advisory that cost us the server was published *after*
the dependency shipped, when nothing in the repo had changed.

## Secrets

Never commit credentials, and never put a fallback credential in `prisma/seed.ts`
or anywhere else. Seeding fails hard when `ADMIN_EMAIL` / `ADMIN_PASSWORD` /
`ADMIN_NAME` are absent, and it must stay that way. Note that Prisma auto-loads
`.env`, which will silently repopulate those variables and mask the failure when
testing it.

## Database

Seeding is idempotent and must stay so: modules key off their stable `code`, so
re-seeding for a content change preserves student progress. Verify that, rather
than assuming it, after touching the seed.
