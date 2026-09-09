# ai.devalier — Learn AI for real decisions

An online learning platform for business decision-makers to build genuine AI
literacy. Publishes to **ai.devalier.com**.

- **Public curriculum** — anyone can read the full course map without an account.
- **Accounts** — students register/sign in to tick boxes, track progress, and
  resume where they left off (progress is saved server-side, across devices).
- **Admin console** — admins configure everything: courses, sections, modules,
  resources/URLs, markdown lesson bodies. No code needed to edit the curriculum.

The MVP ships with the **"AI for Decision-Makers"** course: a two-day taught map
(mechanics, evals, brownfield reality) plus a 30-day forced-use protocol and a
standing-sources library.

## Stack

- **Next.js 15** (App Router) + React 19, TypeScript
- **Prisma** ORM — Postgres
- **JWT session cookies** (`jose`) + `bcryptjs` password hashing
- Bespoke CSS design system (no UI framework) — dark editorial, dense, low-click

## Quick start

Requires a reachable Postgres database (`DATABASE_URL`).

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL, AUTH_SECRET, admin creds
npm run db:push               # create the schema in Postgres
npm run db:seed               # seed the curriculum + first admin
npm run dev                   # http://localhost:3000
```

Secrets (`DATABASE_URL`, `AUTH_SECRET`) live only in the environment — on the
server they're injected by the admin, never committed. `.env` is gitignored.

The seed creates one admin from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and
loads the full curriculum. Sign in as that admin to reach `/admin`.

## Roles

- **Visitor** — reads the curriculum, ticks are prompted to register.
- **Student** — default for anyone who registers. Progress is saved.
- **Admin** — bootstrapped via seed. Reaches `/admin`; the `/admin/*` routes and
  `/api/admin/*` endpoints are guarded by middleware + server-side role checks.

To promote an existing user to admin, set their `role` to `ADMIN` in the DB
(e.g. `npx prisma studio`).

## Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string. SQLite `file:./dev.db` by default. |
| `AUTH_SECRET` | **Required.** Long random string used to sign session JWTs. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | First admin, created by the seed. |

## Production notes

- `DATABASE_URL` and `AUTH_SECRET` are set in the server environment, not the
  repo. Sessions are httpOnly and `secure` in production.
- Apply the schema against the production database once with `npm run db:push`
  (or wire up `prisma migrate deploy`), then `npm run db:seed` to load the
  curriculum and bootstrap the first admin.
- `npm run build` runs `prisma generate` then `next build` — no DB connection
  needed at build time.

## Data model

`User → Progress` and `Course → Section → Module → Resource`. Progress rows
reference either a `moduleId` (map ticks) or a `resourceId` (per-video ticks),
unique per user. See `prisma/schema.prisma`.
