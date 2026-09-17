# learnai.devalier — Learn AI for real decisions

An online learning platform for business decision-makers to build genuine AI
literacy. Publishes to **learnai.devalier.com**.

- **Public curriculum** — anyone can read the full course map without an account.
- **Accounts** — students register/sign in to tick boxes, track progress, and
  resume where they left off (progress is saved server-side, across devices).
- **Admin console** — admins configure everything: courses, sections, modules,
  resources/URLs, markdown lesson bodies. No code needed to edit the curriculum.

The MVP ships with the **"AI for Decision-Makers"** course, aimed at public
administration: two days learning how AI works and where it creates value
(including EU AI Act and data-protection context), a 30-day practice plan, and
a reference library.

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

### Editing content vs. changing the interface

Two different things, two different paths — you rarely touch the database by hand:

- **Interface / wording in the app** (headings, layout, labels): these live in
  the code and ship with a normal deploy. No database step.
- **Curriculum content** (courses, sections, modules, resources): edit it live
  in the **admin console** — no deploy, no reseed.
- **Bulk content updates from the repo**: `npm run db:seed` is **idempotent**.
  It updates the course in place, keyed by each module's `code`, so module ids
  are stable and **existing learner progress is preserved**. Re-run it any time;
  it only removes items you actually deleted from `prisma/seed.ts`.

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

## Knowledge graph (Lattice)

Alongside **The List** the app now carries a shared, multi-user **knowledge
graph** (the first phase of the *Lattice* spec). The List is **not** replaced —
it stays live at `/`, fully seeded and editable in `/admin` — and the graph is
added next to it at **`/map`**.

- **Nodes / Edges / Regions.** A *node* is one idea a practitioner can be wrong
  about; an *edge* is a typed relation (`refines` / `adjacent` / `tension`, never
  a prerequisite); a *region* is a knowledge category for orientation. Node
  positions are frozen per content version so the map doesn't move between visits.
- **Holdings (per user).** A *holding* is your relation to a node — `held` or
  `thin`. The **frontier** (one edge out from what you hold) is never stored, it's
  derived on read. Ticking a List module provisionally *holds* the nodes it maps
  to, so the graph fills in from progress you already have. Held nodes decay to
  `thin` after inactivity or when an author flags a *material* content change —
  run by `POST /api/jobs/decay` (guarded by `JOB_SECRET`; wire it to a nightly cron).
- **Multi-user layer.** The node set is shared; *presence* counts how many people
  hold each node (names only for those who opt in). *Claims* are unsettled
  propositions on a node with for/against positions — one per user per claim, and
  the platform never resolves them.
- **`?view=list`.** Every map affordance has a keyboard-navigable list equivalent
  at `/map?view=list` — the accessibility path, not a reduced product.

### The List → graph mapping

`npm run db:seed` decomposes The List into ~34 nodes across seven knowledge
categories (idempotent, keyed by slug; existing progress and ticks preserved).
Each topic maps to a region and each module's resources carry across as node
references:

| Region | From The List (module topics) |
| --- | --- |
| Foundations | PRE, D1-A |
| Capabilities & levers | D1-B, D1-C |
| Risk, law & governance | D1-D, D2-D |
| Value & decisions | D2-A, D2-C |
| Buying & building | D2-B |
| Practice | 30D |
| Reference | SRC-1, SRC-2 |

Nodes, edges, regions and references are also editable live in the **admin
console** under *Lattice → Knowledge graph*, exactly like The List.

**Deferred to later Lattice phases** (not in this build): the deterministic
simulation runtime (M4) and its SSE stream, the LLM locator/narration gateway
(M1), assigned peer review (M5), and organisations/attestation (M8).
