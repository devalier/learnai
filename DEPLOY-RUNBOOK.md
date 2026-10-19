# learnai: deployment runbook

Covers a first install and an upgrade of an existing deployment, up to and including the "hardening 9, 10, 11, 13" release (Argon2 passwords, versioned migrations, startup checks, health endpoint and structured logs). Tested on Node 22, PostgreSQL 16, Next.js 16.3.8.

Written from the repository as it stands. Where something depends on your host, it says so.

**Which section do I need?**

- **Upgrading an existing deployment:** read section 0 and do its steps in order, then sections 5, 8 and 9.
- **First install:** sections 2 to 8 in order. Skip the baseline step in section 0 (an empty database does not need it).

---

## 0. Read this first (upgrading an existing deployment)

Do these in order. Each one explains what happens if you skip it.

1. **Back up the database** (section 4.1). This release changes how the schema is managed.

2. **Baseline the database, once, before the first build.** Until now the schema was applied with `prisma db push`. The build now runs `prisma migrate deploy`, which refuses a database that has tables but no migration history (error `P3005`). Bring yours under migrations with one command, run with the **owner** role's `DATABASE_URL`:

   ```bash
   cd /srv/learnai && set -a; . /etc/learnai.env; set +a
   ./scripts/db-baseline.sh
   ```

   It checks that the database really matches what this release expects (the only difference allowed is the session-version column, which the next migration adds), refuses and prints the difference if there is any other, and otherwise records the baseline as applied. It changes nothing but the `_prisma_migrations` bookkeeping table. It is safe to run twice, and it does nothing on an empty database. *If you skip it, the build fails with P3005 and changes nothing; you lose a few minutes, not data.*

3. **Check the configuration before you restart.** The server now refuses to start in production (exits with status 1) if `DATABASE_URL` is missing or `AUTH_SECRET` is missing, shorter than 32 characters, a placeholder, or repeats itself. Check without starting anything:

   ```bash
   set -a; . /etc/learnai.env; set +a
   npm run check:env          # exit 0 = would start; exit 1 = would refuse
   ```

   If it reports a weak `AUTH_SECRET`, set a new one (`openssl rand -base64 48`) **before** deploying. That signs everyone out once, which is the price of a weak key. *If you skip this, a weak secret makes the service fail to start after the restart, visibly, with the reason in the log.*

4. **Argon2 is a one-way door for rollback.** New and changed passwords, and every existing account the first time its owner signs in, are stored as Argon2id. **Code from before this release cannot read Argon2 hashes**, so rolling back past it locks out every account that has signed in since. Do not roll back across it: fix forward (section 9). Take the backup in step 1 so there is a way back at all. The module is native (`@node-rs/argon2`, a prebuilt binary, no compiler needed): confirm it loads with `node -e 'require("@node-rs/argon2")'` after `npm ci`. Do not install with `--omit=optional`, which skips the platform binary.

5. **Exactly one trusted proxy must set the client IP.** The app takes the **rightmost** `X-Forwarded-For` entry as the client address. If the proxy does not set it to the real client IP (for example it sees only a CDN's address), **every user shares one IP and the per-IP limits (20 logins / 15 min, 10 sign-ups / h) lock everyone out.** Section 6 and check 5 in section 8 cover this.

6. **Set `APP_URL`** to the public https URL. It is used in emailed links and in the cross-site request check. A wrong value makes real form submissions fail with 403 `CROSS_ORIGIN`.

7. **Build before you start the new version** (section 5). The new code reads columns that the build adds.

---

## 1. What has changed, by release

| Release | Change | Operator impact |
|---|---|---|
| **Security and challenges** | Rate limits on login, sign-up and password reset (table `RateLimit`). Strict nonce-based CSP. Cross-site API writes refused (403). Request size caps (32 KB; admin 512 KB; 1 MB at the edge); malformed JSON gives 400. Admin role read from the database. Hidden posts cannot be judged. Challenges: only the person marked wrong, AI re-check, then admin appeal at `/admin/appeals` (tables `AnswerAppeal`, `QuizQuestionAppeal`). | Users can see HTTP 429. Needs correct `Host` / `X-Forwarded-Host` / `APP_URL`. Admins have a new queue. |
| **Hashed rate-limit keys** | Only a keyed hash of each key is stored: no IPs or emails in the database. Rows swept every 10 minutes; old plaintext rows delete themselves. | The IP check in section 8 uses a hash. |
| **Session hardening** | Tokens last 7 days and slide while in use, with a hard 30-day limit since the last password entry. Column `User.sessionVersion`. "Sign out of all devices" in Settings. A password reset signs out every device. | Nobody is signed out by the deploy. Emergency lever in section 9. |
| **This release** | **Argon2id** password hashing (upgrade on sign-in). **Versioned migrations** replace `db push` (needs the baseline step). **Startup checks** (refuses weak secrets). **`/api/health`**. **Structured JSON logs** with request ids. Secret scan in CI. Password limit raised from 72 to 128 bytes. | Sections 0, 4, 5 and 10. |

---

## 2. Prerequisites

- **Node.js 22 LTS** and npm (CI uses 22). Next 16 needs at least 20.9.
- **PostgreSQL 16** (tested). The database must be reachable **at build time and at run time**, because `npm run build` applies the migrations.
- **Outbound network** from the build host: npm registry and Prisma's engine download (`npm ci` runs `prisma generate`). From the runtime host: your SMTP server, and `api.mistral.ai` over HTTPS (443).
- **A supported CPU/OS for the Argon2 binary** (prebuilt for Linux x64 and arm64, glibc and musl; macOS; Windows; FreeBSD x64). `npm ci` must be allowed to install optional dependencies.
- **TLS in front of the app** (certificate and auto-renewal). Session cookies are `Secure` in production and the app sends HSTS (1 year, `includeSubDomains`), so HTTP-only access will not work.
- A way to run a **nightly job** (cron or systemd timer).
- `openssl`, `psql` and `pg_dump` on the admin machine.
- Memory: allow roughly 300 MB headroom for password hashing on top of the app's normal use (each hash uses 64 MiB, and at most about four run at once).

---

## 3. Environment variables

Store them in a root-owned file (mode 600) or your host's secret manager. **Never commit them.** `.env.example` in the repository lists every variable with placeholders.

| Variable | Required | Purpose / notes |
|---|---|---|
| `DATABASE_URL` | **yes** (build and run) | `postgresql://USER:PASSWORD@HOST:5432/learnai`. Add `?sslmode=require` for a remote database, and e.g. `&connection_limit=10` to cap this process's connection pool. URL-encode special characters in the password. |
| `AUTH_SECRET` | **yes** | Signs session cookies and keys the rate-limit hashes. At least **32 random characters**: `openssl rand -base64 48`. The server refuses to start in production if it is missing, shorter than 32, a placeholder, or repeats a block of 8+ characters. Changing it signs everyone out and resets the rate-limit counters. Keep it off every other service. |
| `APP_URL` | **yes** | Public base URL, e.g. `https://learnai.devalier.com`, no trailing slash. Used for reset-email links and the cross-site check. If unset it defaults to `https://learnai.devalier.com`, and a warning is logged. |
| `JOB_SECRET` | yes, to run the nightly job | Shared secret for `POST /api/jobs/decay`. Without it the endpoint returns 503. `openssl rand -base64 32`. |
| `SMTP_HOST` | yes, for password-reset email | Without it reset emails are not sent (a warning is logged at startup, and each failure is logged). |
| `SMTP_PORT` | no | Default 587 (STARTTLS). |
| `SMTP_SECURE` | no | `true` for implicit TLS (port 465). |
| `SMTP_USER`, `SMTP_PASS` | if your SMTP needs login | |
| `MAIL_FROM` | recommended | e.g. `learnai <no-reply@devalier.com>`. The sending domain should have SPF, DKIM and DMARC. |
| `MISTRAL_API_KEY` | for the AI features | Without it the AI is "unavailable": questions are accepted without a reference answer, answers are not judged, quizzes cannot be created, challenges return 503. |
| `MISTRAL_MODEL` | no | Default `mistral-small-latest`. Read on every call; no redeploy needed to change. |
| `GRAPH_EXPANSION_AUTO` | recommended `off` | `off` sends every community-suggested node to the admin queue instead of publishing it automatically on the AI's say-so. |
| `LOG_LEVEL` | no | `debug`, `info` (default), `warn` or `error`. |
| `CSP_REPORT_ONLY` | no | Emergency lever: `1` makes the CSP report-only (nothing is blocked). See section 9. A warning is logged while it is set. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | **only when seeding** | The seed refuses to run without all three. Do **not** leave `ADMIN_PASSWORD` in the long-running service's environment (a warning is logged if it is there). |
| `NODE_ENV` | `production` | `next start` sets it. If it is anything else the cookie loses `Secure`, the CSP drops `upgrade-insecure-requests`, and the startup checks only warn. |
| `PORT`, `HOSTNAME` | no | Standard Next.js; default port 3000. |
| `MISTRAL_BASE_URL` | **never in production** | Test-only endpoint override (a warning is logged if set). |

Not used by the app: `SESSION_SECRET`.

Example `/etc/learnai.env` (mode 600, owner root):

```
NODE_ENV=production
DATABASE_URL=postgresql://learnai_app:CHANGE_ME@127.0.0.1:5432/learnai?connection_limit=10
AUTH_SECRET=<openssl rand -base64 48>
APP_URL=https://learnai.devalier.com
JOB_SECRET=<openssl rand -base64 32>
GRAPH_EXPANSION_AUTO=off
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="learnai <no-reply@devalier.com>"
MISTRAL_API_KEY=...
```

(The build needs the **owner** role's `DATABASE_URL`, because migrations create tables; the service should run with the restricted role. See 4.4.)

---

## 4. Database

### 4.1 Backup first (always)

```bash
pg_dump --format=custom --file=learnai-$(date +%F-%H%M).dump "$DATABASE_URL"
# prove it is readable:
pg_restore --list learnai-*.dump | head
```

Keep it off the database host. A backup you have never restored is a hope, not a backup: restore it once into a scratch database (`createdb scratch; pg_restore -d scratch file.dump`) the first time.

### 4.2 Fresh install

```bash
createdb learnai   # or your provider's console
# `npm run build` (section 5) creates every table from the migrations; then seed once:
ADMIN_EMAIL=... ADMIN_PASSWORD='...' ADMIN_NAME=... npm run db:seed
```

The seed creates the admin account and the curriculum and graph content. It is idempotent: re-running it updates content in place and preserves student progress and holdings (modules are keyed by a stable `code`; verified: row counts and ids are identical after a re-seed). It needs the three `ADMIN_*` variables or it stops with an error. It does not reset an existing admin's password.

### 4.3 Upgrading an existing database

The one-time baseline is in section 0, step 2. After it, `npm run build` applies the pending migrations. For this release that is one: the column `User.sessionVersion` (integer, default 0), added with `IF NOT EXISTS` so it is harmless on a database that already has it. Verify:

```bash
psql "$DATABASE_URL" -c 'select migration_name, finished_at from _prisma_migrations order by started_at'
psql "$DATABASE_URL" -c '\d "User"' | grep sessionVersion
npm run db:check; echo $?          # 0 = the database matches schema.prisma exactly
```

States an existing database can be in, and what to do:

| State | What you see | Action |
|---|---|---|
| Built by `db push`, no history (all deployments so far) | Build fails with `P3005` | `./scripts/db-baseline.sh`, then build |
| Already baselined | `_prisma_migrations` exists | Just build |
| Changed by hand | `db-baseline.sh` prints the difference and exits 1 | Do not baseline. Find out why, restore or correct it, and run again |
| Empty | no tables | Just build (it creates everything) |

**The new code reads the new column on every signed-in request, so build before you start it.** Started against a database without the column, every signed-in request fails.

### 4.4 Roles (recommended, least privilege)

The build needs DDL rights (`migrate deploy` creates and alters tables); the running app needs only data access. Use two roles if you can:

```sql
-- owner / build role: owns the schema, used only for `npm run build` and db-baseline.sh
-- runtime role:
CREATE ROLE learnai_app LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE learnai TO learnai_app;
GRANT USAGE ON SCHEMA public TO learnai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO learnai_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learnai_app;
ALTER DEFAULT PRIVILEGES FOR ROLE <owner_role> IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO learnai_app;
```

Run the build with the owner role's `DATABASE_URL` and the service with `learnai_app`'s. The database must **not** be reachable from the public internet; allow only the app host.

### 4.5 How schema changes work from now on

Every schema change is a migration file in `prisma/migrations/`, applied by the build. Migrations are **forward-only**: there are no down migrations, and `prisma db push` must not be used against this database. Consequences for you:

- A release with a migration always needs a backup first.
- Migrations are written so the *previous* code can still run against the new schema (add columns with defaults, drop things only in a later release), so rolling the *code* back does not need a database restore (but see the Argon2 warning in section 0).
- If a migration fails half-way, `prisma migrate deploy` reports it and stops; the failed migration is recorded as failed. Restore from the backup, or fix with `prisma migrate resolve` under guidance. Do not edit the database by hand to "make it pass".
- CI builds the schema from an empty database on every change and fails if the schema and migrations disagree, so a migration that does not work from scratch does not reach you.

### 4.6 Restore

```bash
# into a new, empty database:
createdb learnai_restored
pg_restore --no-owner --dbname=learnai_restored learnai-YYYY-MM-DD-HHMM.dump
```

Point `DATABASE_URL` at it only after checking row counts (`select count(*) from "User"`). A restored database already has its migration history, so no baseline is needed.

---

## 5. Build and run

```bash
cd /srv/learnai                       # your install path
git fetch origin
git checkout <the commit you are deploying>
npm ci                                # also runs prisma generate; installs the Argon2 binary
node -e 'require("@node-rs/argon2")' && echo argon2 ok
npm run audit:ci                      # MUST print "found 0 vulnerabilities". Do not deploy on a high or critical finding.
npx tsc --noEmit                      # optional sanity check
set -a; . /etc/learnai.env; set +a    # DATABASE_URL (owner role) must be set for the build
npm run check:env                     # section 0, step 3
./scripts/db-baseline.sh              # first upgrade only (section 0, step 2); harmless otherwise
npm run build                         # applies pending migrations, then builds
```

Check the resolved Next version in the lockfile, not `package.json`:

```bash
node -e 'console.log(require("./package-lock.json").packages["node_modules/next"].version)'   # 16.3.8
```

Advisories are published continuously, so **run the audit again immediately before every deploy**, even if it was clean last week.

Run it as an unprivileged user under systemd (`/etc/systemd/system/learnai.service`):

```ini
[Unit]
Description=learnai
After=network.target postgresql.service

[Service]
User=learnai
WorkingDirectory=/srv/learnai
EnvironmentFile=/etc/learnai.env
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5
# SIGTERM is handled: the server stops within a second. Give in-flight requests time, then force.
KillSignal=SIGTERM
TimeoutStopSec=30
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now learnai && journalctl -u learnai -f
```

The service exits with status 1 (and `Restart=on-failure` keeps retrying every 5 seconds, visibly) if the configuration check fails; the reason is in the log as a `config_error` line.

Bind to `127.0.0.1` so the only way in is the proxy.

**Health checks** (no authentication, nothing sensitive in the body, `Cache-Control: no-store`):

- `GET /api/health`: readiness. `200 {"status":"ok"}` only if the database answers within 2 seconds, else `503 {"status":"unavailable"}`. Use this for the load balancer and the uptime monitor.
- `GET /api/health?live=1`: liveness. `200` if the process is serving, no database. Use this for a "restart if hung" probe, so a database outage does not restart the app.

**Connection pooling:** Prisma keeps a pool per process, sized by `connection_limit` in `DATABASE_URL` (default: 2 x CPUs + 1). If you run several instances, or Postgres has a low `max_connections`, set it explicitly (for example 10) so instances together stay below the database's limit, or put PgBouncer in front (transaction mode needs `?pgbouncer=true` in the URL).

---

## 6. Reverse proxy (nginx example)

Requirements, whatever software you use:

1. Terminate TLS (and redirect http to https).
2. **Set `X-Forwarded-For` to the true client address, replacing anything the client sent** (do not append to a client-supplied value).
3. Pass the original `Host` (or set `X-Forwarded-Host`).
4. Allow request bodies of at least 1 MB.
5. Do not buffer or rewrite bodies in any way that changes their size.
6. Pass `x-request-id` through if your proxy sets one (the app keeps a plain id of 8 to 64 characters and replaces anything else), so proxy and app logs share ids.

```nginx
server {
    listen 443 ssl http2;
    server_name learnai.devalier.com;
    # ssl_certificate / ssl_certificate_key via certbot or your CA

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For   $remote_addr;   # replaces, never appends
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Request-Id      $request_id;    # optional: shared ids in both logs
    }
}
server { listen 80; server_name learnai.devalier.com; return 301 https://$host$request_uri; }
```

**If there is a CDN or another proxy in front of nginx** (Cloudflare, a load balancer): `$remote_addr` is then that proxy's address, not the visitor's. Restore the real client address first with nginx's `realip` module (`set_real_ip_from <CDN ranges>; real_ip_header CF-Connecting-IP;`), then keep `X-Forwarded-For $remote_addr`. Confirm with check 5 in section 8. This is the single most likely cause of "everyone gets rate limited".

If the platform is a managed host (Vercel, Render, Fly, Railway): it already sets the forwarded headers; just run check 5 in section 8 to confirm what address the app records.

---

## 7. Scheduled jobs

**Nightly holdings decay** (marks stale holdings "thin"). Without it, holdings never decay.

Cron does not read your shell environment: define `JOB_SECRET` (and `DATABASE_URL` for the purge below) at the top of the crontab, or put the commands in a script that sources `/etc/learnai.env`.

```cron
17 3 * * *  curl -fsS -X POST -H "x-job-secret: $JOB_SECRET" https://learnai.devalier.com/api/jobs/decay >> /var/log/learnai-decay.log 2>&1
```

Expect `{"ok":true,"elapsed":N,"material":N}`. A 503 means `JOB_SECRET` is not set on the server; 403 means the header is wrong.

**Optional: purge old rate-limit rows.** The app sweeps them itself every 10 minutes while it is receiving traffic, so this only matters on a site that goes idle for long stretches:

```cron
23 3 * * *  psql "$DATABASE_URL" -c "delete from \"RateLimit\" where \"windowStart\" < now() - interval '1 day'"
```

**Backups:** daily `pg_dump` (section 4.1), kept at least 14 days, copied off-host, with a restore test every quarter.

---

## 8. Post-deploy checks

Replace `H` with the public host. Run from a machine that is **not** the server.

```bash
H=https://learnai.devalier.com

# 1. App and database up (readiness), and liveness
curl -s -w ' [%{http_code}]\n' $H/api/health                           # {"status":"ok"} [200]
curl -s -w ' [%{http_code}]\n' "$H/api/health?live=1"                  # {"status":"ok"} [200]

# 2. Security headers (CSP must contain a nonce; HSTS and frame protection present) and a request id
curl -sI $H/login | grep -iE "content-security-policy|strict-transport|x-frame|x-content-type|x-request-id"

# 3. Cross-site write is refused, same-site is not
curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' \
     -H 'Origin: https://evil.example' -d '{"email":"x@x.co","password":"x"}'                      # 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' \
     -H "Origin: $H" -d '{"email":"nobody@x.co","password":"x"}'                                    # 401

# 4. Body limit and malformed JSON
head -c 40000 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' --data-binary @-   # 413
curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' -d '{bad'                                              # 400
```

**5. The recorded client address is the real one (critical).** The table stores only hashes, so check by computing the hash of the address you expect. Send one failed login from your own machine (a made-up email), then, on the server with the service's environment loaded (`set -a; . /etc/learnai.env; set +a`):

```bash
curl -s -o /dev/null -X POST $H/api/auth/login -H 'content-type: application/json' -H "Origin: $H" -d '{"email":"ipcheck@x.co","password":"x"}'
MYIP=$(curl -s https://ifconfig.me)           # your public IP, as the app should see it
KEY=$(node -e 'console.log(require("crypto").createHmac("sha256",process.env.AUTH_SECRET).update("ratelimit:v1:login:ip:"+process.argv[1]).digest("hex"))' "$MYIP")
psql "$DATABASE_URL" -tA -c "select count from \"RateLimit\" where key='$KEY'"      # must print 1 (or more)
```

If it prints nothing, the app is seeing a different address (the proxy's or a CDN's). Stop and fix section 6 before opening to users. Also confirm nothing readable is stored: `select count(*) from "RateLimit" where key !~ '^[0-9a-f]{64}$'` must be `0`.

**6. Rate limit works** (use a made-up email so you lock out no one): six wrong logins in a row give `401 401 401 401 401 429`.

**7. Passwords are being upgraded.** After a few existing users have signed in:

```bash
psql "$DATABASE_URL" -tA -c "select left(\"passwordHash\", 7) as kind, count(*) from \"User\" group by 1"
# '$argon2' grows, '$2b$10$' (bcrypt) shrinks as people sign in
```

**8. The startup check logged what you expect:** `journalctl -u learnai -o cat | grep config_` shows `config_warning` lines only for things you chose not to set (for example no `SMTP_HOST` yet), and no `config_error`.

**9. In a browser:**
- Sign in as the admin; `/admin`, `/admin/appeals`, `/admin/reports` load.
- Open `/map`: the graph renders; the browser console shows **no** "Content Security Policy" errors (a favicon 404 is expected and harmless).
- Register a test account, opt in to social features, ask a question.
- "Forgot password": the email arrives and its link opens `APP_URL`.
- (If `MISTRAL_API_KEY` is set) create a quiz on a node.
- Settings > "Signed-in devices": with two browsers signed in as one test user, use "Sign out of all devices" in one; the other must be signed out on its next click or reload, and the first stays signed in.
- A session cookie from `curl -i` on login shows `Max-Age=604800` (7 days), `HttpOnly`, `Secure`, `SameSite=lax`.

**10. Nightly job:** run the decay `curl` from section 7 once by hand and confirm `{"ok":true,...}`.

**11. Logs:** `journalctl -u learnai --since "10 min ago" -o cat` shows JSON lines and no repeated `error` events.

---

## 9. Rollback

| Problem | Action |
|---|---|
| The site is broken for users and you need the old code | **First check whether the old code can read the data.** Rolling back to a version from **before Argon2** locks out every account that has signed in since this release (the old code cannot read Argon2 hashes): do not do that; fix forward, or restore the pre-upgrade backup (losing everything written since). Rolling back to a version from after Argon2 is fine: `git checkout <commit>`, `npm ci`, `npm run build`, restart. Migrations stay applied; the code is written to run against the earlier schema. After a rollback to before session hardening, sessions revoked with "sign out of all devices" would be accepted again. |
| The service will not start | `journalctl -u learnai -o cat \| grep config_error`: it says which setting. Fix the environment and restart. `npm run check:env` reproduces it. |
| Build fails with `P3005` | The database has tables but no migration history: run `./scripts/db-baseline.sh` (section 0, step 2). Nothing was changed. |
| Build fails with a migration error | Stop. Do not edit the database by hand. The failed migration is recorded; restore from the backup, or get help with `prisma migrate resolve`. |
| CSP breaks a page | Set `CSP_REPORT_ONLY=1` in the env file and `systemctl restart learnai`. Nothing is blocked; violations show in the browser console. Fix, then remove the variable. |
| Real form posts fail with 403 `CROSS_ORIGIN` | `APP_URL` is wrong, or the proxy does not pass `Host` / `X-Forwarded-Host`. Fix the proxy or `APP_URL`; no rollback needed. |
| Everyone gets 429 | The proxy is not passing real client addresses (section 6). Short-term relief: `psql "$DATABASE_URL" -c 'delete from "RateLimit"'`. Then fix the proxy. |
| You suspect a stolen session or a leaked cookie | **Sign everyone out at once, without rotating `AUTH_SECRET`:** `psql "$DATABASE_URL" -c 'update "User" set "sessionVersion" = "sessionVersion" + 1'`. Every existing session is refused on its next request; users simply sign in again. To sign out one person, add `where email = '...'`. |
| Data damaged | Restore from the backup in 4.1 / 4.6 into a fresh database, verify, then switch `DATABASE_URL`. |

---

## 10. What to watch

**Logs.** The service writes one JSON object per line (`ts`, `level`, `event`, optional `requestId`, then fields). Warnings and errors go to stderr, the rest to stdout; under systemd both land in the journal. Read them with `journalctl -u learnai -o cat | jq -R 'fromjson? // empty'` (Next prints a few plain-text startup lines too; this skips them). Emails, passwords, tokens and hashes are never written (any address in an error message is replaced by `[email]`). Every response carries an `x-request-id` header; if a user reports a problem, ask for that value (or the time) and search the log for it.

Events worth alerting on:

| `event` | Means |
|---|---|
| `config_error`, `startup_refused` | The service refused to start. |
| `health_check_failed` | The database is not answering. |
| `login_failed`, `register_failed` | An unexpected server error (500) during sign-in or sign-up; the database is the usual cause. |
| `admin_create_failed`, `admin_update_failed`, `admin_delete_failed` | An admin edit failed. |
| `reset_mail_failed`, `reset_mail_not_configured` | Password-reset emails are not going out. |
| `ai_call_failed`, `ai_invalid_shape` | Mistral is failing or returning junk (a few are normal). |
| `config_warning` (at startup) | A setting you may want: read it. |

**Journal size.** Set `SystemMaxUse=` (for example 1G) and `MaxRetentionSec=` (for example 30 days) in `/etc/systemd/journald.conf`, or ship the logs elsewhere. If you log to files instead, rotate them with `logrotate`.

**Uptime.** Point an external monitor at `GET /api/health` (alert on non-200 for two consecutive checks) and watch certificate expiry.

**Traffic.**

- **HTTP 429** on `/api/auth/*`: a few are normal. A sustained spike is either an attack or the shared-IP misconfiguration.
- **HTTP 403 `CROSS_ORIGIN`** on `/api`: should be near zero. A rise points at a proxy or `APP_URL` problem (or an attacker).
- **HTTP 413**: oversized bodies; a rise means a bot or a mis-set proxy limit.

**People and money.**

- **Admin `/admin/appeals`** and `/admin/reports`: someone should look at these daily. Appeals are private to the person who made them and to admins.
- **Mistral spend:** AI limits are per account only. Set a monthly spending cap in the Mistral console.
- **Disk and table size:** `RateLimit` should stay small (rows live about a day). If it grows past tens of thousands of rows, the app is not sweeping (check the log for database errors) or someone is flooding it.

Not provided: error tracking (for example Sentry) and metrics dashboards. The logs and `/api/health` cover the basics; add either if you need more.

---

## 11. Key and secret rotation

There is no automatic rotation. Do these on a schedule you set (for example yearly), and immediately if a secret may have leaked. Keep a record of the date.

| Secret | Procedure | Impact |
|---|---|---|
| `AUTH_SECRET` | Generate a new one (`openssl rand -base64 48`), update the env file, `npm run check:env`, restart. | **Everyone is signed out once.** Rate-limit counters reset. Nothing else. Schedule it for a quiet hour. (To sign people out *without* rotating, bump `sessionVersion`; section 9.) |
| `JOB_SECRET` | New value in the env file and in the cron job's header; restart the service. | None, if both change together. |
| Database password | `ALTER ROLE learnai_app PASSWORD '...'`, update `DATABASE_URL` in the env file, restart. Then confirm the old password no longer works. | A few seconds of errors during the restart. |
| `MISTRAL_API_KEY` | Create a new key in the Mistral console, update the env file, restart, then revoke the old key. | AI features are briefly unavailable. |
| SMTP password | Change at the mail provider, update the env file, restart; test "Forgot password". | Reset emails fail in between. |
| Admin password | The admin changes it through "Forgot password". | That admin's sessions end. |

If a secret was **committed to the repository**, rotating is not enough on its own: treat it as public, rotate it, and tell the repository owner so the history can be cleaned. CI runs `scripts/scan-secrets.sh` on every push to catch this; GitHub secret scanning with push protection is the second layer (repository settings).

---

## 12. Security checklist (hand-off)

- [ ] HTTPS only; certificate auto-renews; certificate expiry is monitored.
- [ ] Database not exposed publicly; strong unique password; separate owner and runtime roles.
- [ ] `/etc/learnai.env` is mode 600; secrets are not in the repo, shell history or tickets.
- [ ] `npm run check:env` exits 0; `AUTH_SECRET`, `JOB_SECRET` and the DB password are random and distinct; rotation dates recorded (section 11).
- [ ] Daily database backup, stored off-host, and a restore test done. A backup was taken before this upgrade.
- [ ] `npm run audit:ci` clean on the commit being deployed, run today. The repository's GitHub CI also audits daily; someone must read its failures.
- [ ] GitHub: branch protection on `main` (require the CI checks, including "Secret scan" and "Dependency audit"), secret scanning and push protection on. (Dependabot is off on purpose; do not re-enable without asking.)
- [ ] Firewall: only 80/443 public (22 limited to admins); app port 3000 bound to localhost.
- [ ] Spending cap set at Mistral. SPF / DKIM / DMARC set for the mail domain.
- [ ] External uptime monitor on `/api/health`; log retention set.
- [ ] Someone owns `/admin/appeals` and `/admin/reports`.

---

## 13. Not in the code (still open)

- **MFA** is deliberately not implemented (a decision for this app's risk level). Admin accounts are the one place it would matter most; protect them with long unique passwords.
- No error-tracking service and no metrics dashboards (section 10).
- Register still tells a visitor when an email is already taken (mitigated by the rate limit only).
- Logging out on one device only clears that cookie. A copied cookie works until it expires (at most 7 days) or "Sign out of all devices" / a password reset is used.
- Repository settings (branch protection, GitHub secret scanning) are the repository owner's to switch on.

**Privacy text (owner's call):** no IP address or email is stored for throttling (only keyed hashes, kept about a day), and logs contain no email addresses, so the privacy page's "no IP address" statement holds. A keyed hash is still pseudonymous data. Mentioning throttling counters in the privacy policy is optional; if you do, changing `POLICY_VERSION` makes every user re-acknowledge.
