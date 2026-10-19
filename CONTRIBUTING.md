# Contributing

Thanks for wanting to help. This project is in the **public domain** and stays that
way, which shapes a few of the rules below.

## Your contribution goes into the public domain

By opening a pull request you agree that:

1. you wrote the contribution, or have the right to dedicate it; and
2. you dedicate it to the public domain under the [Unlicense](LICENSE), the same terms as
   the rest of the project.

If you cannot say that (your employer owns what you write, or part of the code comes
from somewhere else), please do not submit it.

**Do not copy code from projects under other licenses**, especially GPL, LGPL or AGPL
code, or anything without a license. It cannot go into a public-domain project. Small
snippets from documentation that is explicitly free to use are fine; say where they came
from in the pull request.

AI-assisted contributions are welcome. You are responsible for them exactly as if you had
written every line: understand it, test it, and mention in the pull request that a tool
helped.

## Getting started

Follow "Quick start" in the [README](README.md). Then:

```bash
git checkout -b my-change
# ...make the change...
```

Keep a pull request to **one thing**. A small, focused change is reviewed quickly; a
large mixed one waits. If you want to do something big, open an issue first and say
so, so we can agree on the shape before you spend the time.

## Before you open a pull request

Run all of these. CI runs them too, and a pull request that fails them cannot be merged.

```bash
npx tsc --noEmit            # types
npm run audit:ci            # no high or critical advisories in the lockfile
./scripts/scan-secrets.sh   # no committed credentials
npm run build               # applies the migrations to your local database, then builds
npm run db:check            # the database the migrations built equals prisma/schema.prisma
```

There is no unit-test suite yet. So in the pull request, **say how you checked that it
works**: what you ran, what you clicked, what you expected and saw. For anything that
touches sign-in, sessions, permissions, user data or the AI features, that description is
the most important part of the pull request.

## Rules that are easy to break

- **Dependencies.** Think twice before adding one: every dependency is code we run and
  trust. Explain why it is needed and why the standard library or existing code is not
  enough. Commit the updated `package-lock.json`, and `npm run audit:ci` must be clean
  **on the lockfile**, not just the manifest. Dependabot is switched off on purpose; do
  not add it back.
- **Database changes are migrations.** Edit `prisma/schema.prisma`, then run
  `npx prisma migrate dev --name what_changed` and commit the new folder in
  `prisma/migrations/` with the schema change. Never use `prisma db push` against anything
  but a throwaway local database. Write migrations so the *previous* version of the code
  still works against them (add columns with defaults; drop things only in a later
  release). CI fails if the schema and the migrations disagree.
- **No secrets, ever.** Not in code, tests, comments, screenshots or commit messages.
  There is deliberately no default admin password and no fallback credential; do not add
  one. If you committed a secret by accident, tell us right away: it must be rotated, and
  deleting it in a later commit does not remove it from history.
- **No personal data.** Do not put real names, emails, addresses or user data in code,
  fixtures or screenshots.
- **Validate input and check permissions on the server.** Anything the browser sends is
  untrusted. Look at how an existing route does it (`src/lib/body.ts`, `getSession`,
  `requireAdmin`) and do the same.
- **Match the surrounding code**: naming, comments, and level of detail.

## What happens next

A maintainer reviews the pull request when they can; this is a small project, so please be
patient. Expect questions, and expect to be asked to change things. Pull requests that
fail CI, or that are left without a reply to review comments for a long time, may be
closed; you are welcome to reopen them.

Be kind. Assume good faith, criticize code and not people, and keep discussion on topic.
Harassment or abuse gets you removed from the project.

## Reporting a security problem

**Do not open a public issue or pull request for a vulnerability.** See
[SECURITY.md](SECURITY.md).
