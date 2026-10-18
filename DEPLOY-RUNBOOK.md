# learnai: deployment runbook (release: items 1–7 + challenge appeals)

Target commit: `ebf2b544ab7807f2d473d0ea5feb369a33d21dee` (`main`, merge of PR #41). Tested on Node 22, PostgreSQL 16, Next.js 16.3.8.

Written from the repository as it stands. Where something depends on your host, it says so.

---

## 0. Read this first

1. **Owner decision (privacy).** The new rate limiter stores **client IP addresses and email addresses** in a database table (`RateLimit`, keys like `login:ip:203.0.113.7`, `login:email:alice@example.com`). The privacy page (`src/app/privacy/page.tsx`, line 52) says sign-in metadata keeps "no IP address or device details". Rows are only swept probabilistically (about 1 request in 100, rows older than 24 h), so on a quiet site they can sit longer. Either:
   - (a) hash the keys and sweep deterministically (a small code change; recommended), or
   - (b) deploy as is and amend the privacy text (bumping `POLICY_VERSION` makes every user re-acknowledge it).
   Until decided, do the optional cleanup cron in section 7 so nothing is kept more than a day.
2. **Exactly one trusted proxy must set the client IP.** The app takes the **rightmost** `X-Forwarded-For` entry as the client address. If the proxy does not set it to the real client IP (for example it sees only a CDN's address), **every user shares one IP and the per-IP limits (20 logins / 15 min, 10 sign-ups / h) lock everyone out.** Section 6 and the check in section 8 cover this.
3. **Set `APP_URL`** to the public https URL. It is used in emailed links and in the cross-site request check. A wrong value makes real form submissions fail with 403 `CROSS_ORIGIN`.
4. **Take a database backup before anything else** (section 4.1).

---

## 1. What this release changes

| Area | Change | Operator impact |
|---|---|---|
| Login, sign-up, forgot password | Rate limits, stored in Postgres | Users can see HTTP 429. New table `RateLimit`. |
| Login | Equal response time for unknown accounts | none |
| Security headers | Strict nonce-based CSP on pages; `proxy.ts` replaces `middleware.ts` | A blocked third-party asset shows as a CSP console error. The app has none today. |
| API writes | Cross-site requests refused (403) | Needs correct `Host` / `X-Forwarded-Host` / `APP_URL`. |
| Requests | Body size caps (32 KB; admin 512 KB; 1 MB hard limit at the edge); malformed JSON gives 400 | Proxy limit should be at least 1 MB. |
| Passwords | New passwords: 8 to 72 **bytes** | Existing accounts unaffected. |
| Sessions | Admin role is read from the database, not the 30-day token | A demoted admin loses access at once. |
| Moderation | Hidden posts cannot be judged or re-graded | none |
| Challenges | Only the person marked wrong can challenge; then an AI re-check; then an admin appeal. Admins decide at `/admin/appeals` | Admins have a new queue to watch. New tables `AnswerAppeal`, `QuizQuestionAppeal`. |
| Account deletion | Password attempts limited (5 / 15 min) | none |

**Database change is additive only:** three new tables and one enum. Nothing existing is altered or dropped.

---

## 2. Prerequisites

- **Node.js 22 LTS** and npm (CI uses 22). Next 16 needs at least 20.9.
- **PostgreSQL 16** (tested). The database must be reachable **at build time and at run time**, because `npm run build` applies the schema (`prisma db push`).
- **Outbound network** from the build host: npm registry and Prisma's engine download (`npm ci` runs `prisma generate`). From the runtime host: your SMTP server, and `api.mistral.ai` over HTTPS (443).
- **TLS in front of the app** (certificate and auto-renewal). Session cookies are `Secure` in production and the app sends HSTS (1 year, `includeSubDomains`), so HTTP-only access will not work.
- A way to run a **nightly job** (cron or systemd timer).
- `openssl` and `psql` / `pg_dump` on the admin machine.

---

## 3. Environment variables

Store them in a root-owned file (mode 600) or your host's secret manager. **Never commit them.**

| Variable | Required | Purpose / notes |
|---|---|---|
| `DATABASE_URL` | **yes** (build and run) | `postgresql://USER:PASSWORD@HOST:5432/learnai`. Add `?sslmode=require` for a remote database. URL-encode special characters in the password. |
| `AUTH_SECRET` | **yes** | Signs session cookies. Generate: `openssl rand -base64 48`. The app does not enforce a minimum length, so use 32+ random bytes. Changing it signs everyone out. Keep it off every other service. |
| `APP_URL` | **yes** | Public base URL, e.g. `https://learnai.devalier.com`, no trailing slash. Used for reset-email links and the cross-site check. If unset it defaults to `https://learnai.devalier.com`. |
| `JOB_SECRET` | yes, to run the nightly job | Shared secret for `POST /api/jobs/decay`. Without it the endpoint returns 503. `openssl rand -base64 32`. |
| `SMTP_HOST` | yes, for password-reset email | Without it reset emails are not sent (the failure is only logged). |
| `SMTP_PORT` | no | Default 587 (STARTTLS). |
| `SMTP_SECURE` | no | `true` for implicit TLS (port 465). |
| `SMTP_USER`, `SMTP_PASS` | if your SMTP needs login | |
| `MAIL_FROM` | recommended | e.g. `learnai <no-reply@devalier.com>`. The sending domain should have SPF, DKIM and DMARC. |
| `MISTRAL_API_KEY` | for the AI features | Without it the AI is "unavailable": questions are accepted without a reference answer, answers are not judged, quizzes cannot be created, challenges return 503. |
| `MISTRAL_MODEL` | no | Default `mistral-small-latest`. Read on every call; no redeploy needed to change. |
| `GRAPH_EXPANSION_AUTO` | recommended `off` | `off` sends every community-suggested node to the admin queue instead of publishing it automatically on the AI's say-so. Leave unset only if you accept AI-published content. |
| `CSP_REPORT_ONLY` | no | Emergency lever: `1` makes the CSP report-only (nothing is blocked). See section 9. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | **only when seeding** | The seed refuses to run without all three. They are not needed at runtime: do **not** leave `ADMIN_PASSWORD` in the long-running service's environment. |
| `NODE_ENV` | `production` | `next start` sets it. If it is anything else the cookie loses `Secure` and the CSP drops `upgrade-insecure-requests`. |
| `PORT`, `HOSTNAME` | no | Standard Next.js; default port 3000. |
| `MISTRAL_BASE_URL` | **never in production** | Test-only endpoint override. |

Not used by the app: `SESSION_SECRET` (it only appears in the CI workflow).

Example `/etc/learnai.env` (mode 600, owner root):

```
NODE_ENV=production
DATABASE_URL=postgresql://learnai_app:CHANGE_ME@127.0.0.1:5432/learnai
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
# the schema is created by the build (section 5); then seed once:
ADMIN_EMAIL=... ADMIN_PASSWORD='...' ADMIN_NAME=... npm run db:seed
```

The seed creates the admin account and the curriculum and graph content. It is idempotent: re-running it updates content in place and preserves student progress (modules are keyed by a stable `code`). It needs the three `ADMIN_*` variables or it stops with an error. It does not reset an existing admin's password.

### 4.3 Upgrading an existing database (this release)

Nothing to run by hand. `npm run build` runs `prisma db push`, which creates:

- table `RateLimit` (`key`, `count`, `windowStart`)
- table `AnswerAppeal`, table `QuizQuestionAppeal`
- enum `AppealStatus`

No seed is needed for this release unless the curriculum content changed.

Verify afterwards:

```bash
psql "$DATABASE_URL" -c '\dt "RateLimit" "AnswerAppeal" "QuizQuestionAppeal"'
```

**Order matters:** the new code expects these tables. Build (which applies the schema) **before** starting the new version. If the new app is started against a database without them, login and sign-up return errors.

### 4.4 Roles (recommended, least privilege)

`db push` needs DDL rights at build time; the running app needs only data access. Use two roles if you can:

```sql
-- owner / build role: owns the schema, used only for `npm run build`
-- runtime role:
CREATE ROLE learnai_app LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE learnai TO learnai_app;
GRANT USAGE ON SCHEMA public TO learnai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO learnai_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learnai_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO learnai_app;
```

Run the build with the owner role's `DATABASE_URL` and the service with `learnai_app`'s. Also: the database must **not** be reachable from the public internet; allow only the app host.

### 4.5 Known limitation of `db push`

It is not a versioned migration system and has no down migrations. For this release it only adds tables, so it is safe. A future change that drops or narrows a column will make `db push` refuse to run unattended (it warns about data loss). Treat that as the safety working, and do not add `--accept-data-loss` to the build. Moving to `prisma migrate deploy` is on the plan (item 10).

### 4.6 Restore

```bash
# into a new, empty database:
createdb learnai_restored
pg_restore --no-owner --dbname=learnai_restored learnai-YYYY-MM-DD-HHMM.dump
```

Point `DATABASE_URL` at it only after checking row counts (`select count(*) from "User"`).

---

## 5. Build and run

```bash
cd /srv/learnai                       # your install path
git fetch origin
git checkout ebf2b544ab7807f2d473d0ea5feb369a33d21dee
npm ci                                # also runs prisma generate
npm run audit:ci                      # MUST print "found 0 vulnerabilities". Do not deploy on a high or critical finding.
npx tsc --noEmit                      # optional sanity check
set -a; . /etc/learnai.env; set +a    # DATABASE_URL must be set for the build
npm run build                         # applies the schema, then builds
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
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now learnai && journalctl -u learnai -f
```

Bind to `127.0.0.1` so the only way in is the proxy. There is no dedicated health endpoint. For a probe, `GET /api/graph/slice` returns 200 when the app and database are healthy (503 `GRAPH_SCHEMA_MISSING` if the schema is missing); `GET /login` checks the app alone.

---

## 6. Reverse proxy (nginx example)

Requirements, whatever software you use:

1. Terminate TLS (and redirect http to https).
2. **Set `X-Forwarded-For` to the true client address, replacing anything the client sent** (do not append to a client-supplied value).
3. Pass the original `Host` (or set `X-Forwarded-Host`).
4. Allow request bodies of at least 1 MB.
5. Do not buffer or rewrite bodies in any way that changes their size.

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
    }
}
server { listen 80; server_name learnai.devalier.com; return 301 https://$host$request_uri; }
```

**If there is a CDN or another proxy in front of nginx** (Cloudflare, a load balancer): `$remote_addr` is then that proxy's address, not the visitor's. Restore the real client address first with nginx's `realip` module (`set_real_ip_from <CDN ranges>; real_ip_header CF-Connecting-IP;`), then keep `X-Forwarded-For $remote_addr`. Confirm with the check in section 8 step 5. This is the single most likely cause of "everyone gets rate limited".

If the platform is a managed host (Vercel, Render, Fly, Railway): it already sets the forwarded headers; just run step 5 of section 8 to confirm what address the app records.

---

## 7. Scheduled jobs

**Nightly holdings decay** (marks stale holdings "thin"). Without it, holdings never decay.

Cron does not read your shell environment: define `JOB_SECRET` (and `DATABASE_URL` for the purge below) at the top of the crontab, or put the commands in a script that sources `/etc/learnai.env`.

```cron
17 3 * * *  curl -fsS -X POST -H "x-job-secret: $JOB_SECRET" https://learnai.devalier.com/api/jobs/decay >> /var/log/learnai-decay.log 2>&1
```

Expect `{"ok":true,"elapsed":N,"material":N}`. A 503 means `JOB_SECRET` is not set on the server; 403 means the header is wrong.

**Optional but recommended: purge old rate-limit rows** (also limits how long IPs and emails are kept; see section 0):

```cron
23 3 * * *  psql "$DATABASE_URL" -c "delete from \"RateLimit\" where \"windowStart\" < now() - interval '1 day'"
```

**Backups:** daily `pg_dump` (section 4.1), kept at least 14 days, copied off-host, with a restore test every quarter.

---

## 8. Post-deploy checks

Replace `H` with the public host. Run from a machine that is **not** the server.

```bash
H=https://learnai.devalier.com

# 1. App and database up
curl -s -o /dev/null -w "%{http_code}\n" $H/api/graph/slice            # 200

# 2. Security headers (CSP must contain a nonce; HSTS and frame protection present)
curl -sI $H/login | grep -iE "content-security-policy|strict-transport|x-frame|x-content-type"

# 3. Cross-site write is refused, same-site is not
curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' \
     -H 'Origin: https://evil.example' -d '{"email":"x@x.co","password":"x"}'                      # 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' \
     -H "Origin: $H" -d '{"email":"nobody@x.co","password":"x"}'                                    # 401

# 4. Body limit and malformed JSON
head -c 40000 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' --data-binary @-   # 413
curl -s -o /dev/null -w "%{http_code}\n" -X POST $H/api/auth/login -H 'content-type: application/json' -d '{bad'                                              # 400
```

**5. The recorded client address is the real one (critical).** Send one failed login from your own machine (use a made-up email), then look at what the app stored:

```bash
curl -s -o /dev/null -X POST $H/api/auth/login -H 'content-type: application/json' -H "Origin: $H" -d '{"email":"ipcheck@x.co","password":"x"}'
psql "$DATABASE_URL" -c "select key, count from \"RateLimit\" where key like 'login:ip:%' order by \"windowStart\" desc limit 3"
```

The `login:ip:` row must show **your public IP**. If it shows the proxy's or a CDN's address, stop and fix section 6 before opening to users.

**6. Rate limit works** (use a made-up email so you lock out no one): six wrong logins in a row give `401 401 401 401 401 429`.

**7. In a browser:**
- Sign in as the admin; `/admin`, `/admin/appeals`, `/admin/reports` load.
- Open `/map`: the graph renders; the browser console shows **no** "Content Security Policy" errors (a favicon 404 is expected and harmless).
- Register a test account, opt in to social features, ask a question.
- "Forgot password": the email arrives and its link opens `APP_URL`.
- (If `MISTRAL_API_KEY` is set) create a quiz on a node.

**8. Nightly job:** run the decay `curl` from section 7 once by hand and confirm `{"ok":true,...}`.

**9. Logs:** `journalctl -u learnai --since "10 min ago"` shows no repeated errors.

---

## 9. Rollback

| Problem | Action |
|---|---|
| The site is broken for users and you need the old code | `git checkout <previous commit>`, `npm ci`, `npm run build`, restart. **The new tables can stay**: old code ignores them. No database restore is needed. |
| CSP breaks a page | Set `CSP_REPORT_ONLY=1` in the env file and `systemctl restart learnai`. Nothing is blocked; violations show in the browser console. Fix, then remove the variable. |
| Real form posts fail with 403 `CROSS_ORIGIN` | `APP_URL` is wrong, or the proxy does not pass `Host` / `X-Forwarded-Host`. Fix the proxy or `APP_URL`; no rollback needed. |
| Everyone gets 429 | The proxy is not passing real client addresses (section 6). Short-term relief: `psql "$DATABASE_URL" -c 'delete from "RateLimit"'`. Then fix the proxy. |
| Data damaged | Restore from the backup in 4.1 / 4.6 into a fresh database, verify, then switch `DATABASE_URL`. |

---

## 10. What to watch

- **HTTP 429** on `/api/auth/*`: a few are normal. A sustained spike is either an attack or the shared-IP misconfiguration.
- **HTTP 403 `CROSS_ORIGIN`** on `/api`: should be near zero. A rise points at a proxy or `APP_URL` problem (or an attacker).
- **HTTP 413**: oversized bodies; a rise means a bot or a mis-set proxy limit.
- **Admin `/admin/appeals`** and `/admin/reports`: someone should look at these daily. Appeals are private to the person who made them and to admins.
- **Mistral spend:** AI limits are per account only. Set a monthly spending cap in the Mistral console.
- **Disk and table size:** `RateLimit` should stay small (rows live about a day). If it grows past tens of thousands of rows, the purge cron is not running.
- Failed SMTP delivery only appears in the service log ("Password reset email failed").

---

## 11. Security checklist (hand-off)

- [ ] HTTPS only; certificate auto-renews; certificate expiry is monitored.
- [ ] Database not exposed publicly; strong unique password; separate owner and runtime roles.
- [ ] `/etc/learnai.env` is mode 600; secrets are not in the repo, shell history or tickets.
- [ ] `AUTH_SECRET`, `JOB_SECRET` and the DB password are random and distinct. Know how to rotate them (rotating `AUTH_SECRET` signs everyone out).
- [ ] Daily database backup, stored off-host, and a restore test done.
- [ ] `npm run audit:ci` clean on the commit being deployed, run today. The repository's GitHub CI also audits daily; someone must read its failures.
- [ ] GitHub: branch protection on `main` (require the CI checks), secret scanning and push protection on. (Dependabot is off on purpose; do not re-enable without asking.)
- [ ] Firewall: only 80/443 public (22 limited to admins); app port 3000 bound to localhost.
- [ ] Spending cap set at Mistral. SPF / DKIM / DMARC set for the mail domain.
- [ ] The privacy decision in section 0 is made and recorded.

---

## 12. Not in this release (still open)

Session hardening (shorter token life, sign-out-everywhere), stronger password hashing (argon2), versioned migrations, startup check for a weak `AUTH_SECRET`, MFA, a health endpoint, structured logging, and GitHub repository settings. Register still tells a visitor when an email is already taken (mitigated by the rate limit only).
