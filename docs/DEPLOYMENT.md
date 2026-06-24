# Running 24×7 in production

The dashboard is a standard Next.js server. For always-on use, build once and run
the production server under a process manager that restarts on crash/reboot.

## 1. Build & start

```bash
npm install
npm run build        # compile (do this after every code change)
npm start            # serves on http://localhost:3000 (set PORT to change)
```

`npm run dev` is for development only — do not use it for 24×7.

## 2. Keep it alive with PM2 (recommended)

```bash
npm install -g pm2
npm run build
pm2 start "npm run start" --name notifyme-admin
pm2 save                 # remember across reboots
pm2 startup              # follow the printed command to enable on boot
pm2 logs notifyme-admin  # view logs
```

Update after code changes:

```bash
npm run build && pm2 restart notifyme-admin
```

## 3. Reliability features already built in

- **DB pool** with `enableKeepAlive` so idle RDS/NAT timeouts don't drop sockets,
  and an automatic **one-retry** on transient connection errors
  (`PROTOCOL_CONNECTION_LOST`, `ECONNRESET`, `ETIMEDOUT`, …) — see `lib/db.ts`.
- **Per-query isolation**: every metric runs through `safe()`, so one failing
  query degrades a single card, never the whole page.
- **In-memory TTL cache** (`lib/cache.ts`): global pages cached 60s, shop views
  30s. This keeps the 1.1M-row queries from being recomputed on every request and
  bounds DB load under concurrent users.
- Pool size is configurable via `DB_POOL_SIZE` (default 8).

## 4. Environment

`.env.local` must be present next to `package.json` with the DB credentials. The
host running this must reach the RDS endpoint (security-group allow-listed IP/VPN).

Tunables (optional) in `.env.local`:

```
DB_POOL_SIZE=8     # max pooled connections
PORT=3000          # server port (npm start)
```

## 5. Health & data verification

- `node scripts/verify-all.mjs` — reconciliation checks (totals add up, funnel
  monotonic, per-shop rollups match global). Exits non-zero on any failure, so it
  can run as a cron/health check.
- `node scripts/verify.mjs <shop-domain>` — raw cross-table dump for one shop.
- `npm run inspect` — regenerate the full schema report.

A simple hourly health cron:

```bash
0 * * * * cd /path/to/notifyme-admin-dashboard && node scripts/verify-all.mjs >> verify.log 2>&1
```
