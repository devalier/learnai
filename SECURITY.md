# Security policy

## Reporting a vulnerability

Please report it **privately**, so it can be fixed before it is public:

- On GitHub: **Security** tab → **Report a vulnerability** (a private security advisory
  visible only to the maintainers and you).

Please do **not** open a public issue or pull request, and do not post it anywhere public,
until it has been fixed.

Include what you found, where (file, route or page), the steps to reproduce it, and what
an attacker could do with it. A short proof of concept helps. If you can, say which
version or commit you tested.

This is a small project run by volunteers, so replies are best-effort, but every report
is read and taken seriously. You will get an answer, and you will be credited in the fix
if you want to be.

## What is in scope

The code in this repository, and a deployment that follows [`DEPLOY-RUNBOOK.md`](DEPLOY-RUNBOOK.md).
Examples: authentication and sessions, authorization (one user reaching another's data, or
a student reaching admin functions), injection, cross-site scripting, request forgery,
server-side request forgery, secrets handling, and insecure defaults.

## Please do not

- test against the live site with anything but an account you created yourself, or touch
  other people's data;
- run denial-of-service tests, automated scanners at volume, or social engineering against
  users or maintainers;
- demand payment: there is no bounty program.

## Dependencies

Dependencies are audited on every change and daily (`npm audit` in CI). If you find an
advisory the audit misses, report it the same way.

## Supported versions

Only the latest commit on `main` is supported.
