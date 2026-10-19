# learnai.devalier — Learn AI for real decisions

An online learning platform for business decision-makers to build genuine AI
literacy. Publishes to **learnai.devalier.com**.

**This project is in the public domain** ([Unlicense](LICENSE)). Use it, change it,
run your own, sell it, no permission needed. Contributions are welcome:
see [CONTRIBUTING.md](CONTRIBUTING.md).

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

- **Next.js 16** (App Router) + React 19, TypeScript
- **Prisma 6** ORM, PostgreSQL, versioned migrations (`prisma/migrations`)
- **JWT session cookies** (`jose`), **Argon2id** password hashing
- Optional AI features through the Mistral API (without a key they are simply unavailable)
- Bespoke CSS design system (no UI framework): dark editorial, dense, low-click

## Quick start (local development)

You need Node.js 22 and a PostgreSQL 16 database. The quickest database:

```bash
docker run --name learnai-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=learnai -p 5432:5432 -d postgres:16
```

Then:

```bash
npm install
cp .env.example .env          # then edit .env, see below
npm run db:migrate            # create the schema from the migrations
npm run db:seed               # load the curriculum and create the first admin
npm run dev                   # http://localhost:3000
```

In `.env` set at least:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/learnai"
AUTH_SECRET="<output of: openssl rand -base64 48>"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="<something you choose>"
ADMIN_NAME="Admin"
```

`.env.example` documents every variable the app reads. Secrets live only in the
environment; `.env` is gitignored and must never be committed. (`npm run check:env`
runs the same configuration checks the server runs at startup.)

The seed creates one admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` and loads the full
curriculum. It stops with an error if those are missing: there is deliberately no
default password. Sign in as that admin to reach `/admin`.

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
  `/api/admin/*` endpoints are guarded by the proxy and server-side role checks.

To promote an existing user to admin, set their `role` to `ADMIN` in the DB
(e.g. `npx prisma studio`).

## Configuration and deployment

Every environment variable is listed, with what it does, in [`.env.example`](.env.example).

To run your own copy in production, follow [`DEPLOY-RUNBOOK.md`](DEPLOY-RUNBOOK.md): it
covers the database, environment, reverse proxy, scheduled jobs, health checks and
rollback. Two things worth knowing up front:

- **Schema changes are migrations** (`prisma/migrations`), applied by `npm run build`
  (`prisma migrate deploy`). `prisma db push` is for throwaway local databases only.
  A database built before migrations existed is brought under them once with
  `npm run db:baseline`.
- **The legal pages carry the operator's identity.** `src/lib/legal.ts` names the data
  controller (name, address, contact, supervisory authority) for the privacy policy and
  terms. If you run your own copy, replace those with your own details and review the
  policy text: it describes how *this* deployment handles personal data.

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

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: it explains
the checks a change must pass and that contributions are dedicated to the public
domain. To report a security problem, see [SECURITY.md](SECURITY.md) and **do not open
a public issue**.

## License

Public domain, under the [Unlicense](LICENSE). Third-party dependencies keep their own
licenses (see `package-lock.json`).
