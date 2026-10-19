## What and why

<!-- One thing per pull request. What does it change, and why? -->

## How I checked it works

<!-- What you ran, clicked or tried, and what you saw. There is no test suite yet, so this
     matters. For sign-in, sessions, permissions, user data or AI features, be specific. -->

## Checklist

- [ ] `npx tsc --noEmit`, `npm run audit:ci`, `./scripts/scan-secrets.sh` and `npm run build` pass
- [ ] If I changed `prisma/schema.prisma`, I added a migration (`npx prisma migrate dev`), and `npm run db:check` passes
- [ ] If I added or changed a dependency, I explained why below and the lockfile audit is clean
- [ ] No secrets, and no real personal data, anywhere (code, comments, screenshots, commits)
- [ ] I wrote this (or have the right to dedicate it), I did not copy code from projects under other licenses, and I dedicate it to the public domain under the [Unlicense](../LICENSE)
- [ ] If an AI tool helped, I understand and tested every line, and I said so here

<!-- Dependency changes: which package, what for, why not existing code. -->
