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
- **Prisma** ORM — SQLite by default, swap to Postgres for production
- **JWT session cookies** (`jose`) + `bcryptjs` password hashing
- Bespoke CSS design system (no UI framework) — dark editorial, dense, low-click

## Quick start

```bash
npm install
cp .env.example .env          # then edit AUTH_SECRET + admin bootstrap creds
npm run db:push               # create the database schema
npm run db:seed               # seed the curriculum + first admin
npm run dev                   # http://localhost:3000
```

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

- Set a strong `AUTH_SECRET`. Sessions are httpOnly, `secure` in production.
- **Postgres:** change `datasource db { provider = "postgresql" }` in
  `prisma/schema.prisma`, set `DATABASE_URL`, then `npm run db:push`. SQLite does
  not persist on ephemeral/serverless filesystems.
- `npm run build` runs `prisma generate` then `next build`.

## Data model

`User → Progress` and `Course → Section → Module → Resource`. Progress rows
reference either a `moduleId` (map ticks) or a `resourceId` (per-video ticks),
unique per user. See `prisma/schema.prisma`.
