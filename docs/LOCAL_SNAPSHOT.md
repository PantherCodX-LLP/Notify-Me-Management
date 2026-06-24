# Local snapshot stack (Docker Compose)

Instead of querying production RDS live, this runs everything locally from the
**daily SQL dumps in your shared Google Drive folder**:

```
Google Drive shared folder (daily *.sql / *.sql.gz)
        │  every morning 09:00 — pick the NEWEST file, skip if unchanged
        ▼
  importer ── import into staging ── add indexes ── atomic table swap ──► live "app_bis"
        ▼
   mysql  ◄────────── dashboard (Next.js, reads local MySQL)  ──► http://localhost:3000
```

Three services: **mysql**, **dashboard**, **importer**. Production RDS is never
touched by the app.

## Daily behaviour (what you asked for)

Every day at **09:00** (`IMPORT_HOUR`/`IMPORT_MINUTE`, in `TZ`) the importer:
1. lists the shared folder `GDRIVE_FOLDER_ID`,
2. picks the **newest** `.sql` / `.sql.gz` / `.zip` file,
3. if that file is **the same as the last import**, it does nothing and keeps the
   current snapshot; if it's **new**, it imports it and swaps it in.

It also runs once on startup when `IMPORT_ON_START=true`.

## Do I need Docker Desktop?

- **Windows / Mac:** yes — install **Docker Desktop**. Its **Containers** panel
  shows the 3 services, their logs and CPU/memory, with start/stop buttons.
- **Linux server:** Docker Engine + compose plugin, no Desktop needed.

See services from the CLI:
```bash
docker compose ps
docker compose logs -f importer     # watch the morning import
docker stats
```

## One-time setup

1. **Install Docker Desktop** (Windows/Mac) and start it.

2. **Env file:**
   ```bash
   cp .env.docker.example .env
   ```
   It already has your folder id `GDRIVE_FOLDER_ID=11hiUAwq5W4XW1hIAmETKHnHi5tkHjVI3`
   and `IMPORT_HOUR=9`. Set a strong `MYSQL_ROOT_PASSWORD` and the right `TZ`.

3. **rclone for Google Drive** (creates `docker/rclone.conf`). Authorize with the
   **Google account the folder is shared with**:
   ```bash
   rclone config        # n) new remote -> name: gdrive -> Google Drive -> log in
   # copy the generated config into the project:
   #   Windows:   copy %USERPROFILE%\.config\rclone\rclone.conf docker\rclone.conf
   #   Mac/Linux: cp ~/.config/rclone/rclone.conf docker/rclone.conf
   ```
   Verify the importer can see the folder (the id is used as the root):
   ```bash
   rclone lsf "gdrive,root_folder_id=11hiUAwq5W4XW1hIAmETKHnHi5tkHjVI3:"
   # should list your daily *.sql files
   ```
   `docker/rclone.conf` and `.env` are gitignored — keep them private.

4. **Dump format:** files should be a `mysqldump` of `app_bis` (made without
   `--databases`; `.sql`, `.sql.gz`, `.zip` all work). The importer also strips
   `CREATE DATABASE` / `USE` lines, so a single-DB dump is safest.

## Run

```bash
docker compose up -d --build
docker compose logs -f importer     # watch the first import
```
Open **http://localhost:3000** once the import finishes.

Trigger an import on demand:
```bash
docker compose exec importer /app/import.sh
```
Force a re-import of the same newest file (clear the marker):
```bash
docker compose exec importer sh -c 'rm -f /state/last_import.txt' && docker compose exec importer /app/import.sh
```
Rebuild after a code change:
```bash
docker compose up -d --build dashboard
```

## Why it's fast

The importer adds indexes prod lacks (`docker/indexes.sql`) — e.g.
`variant_stock_notifications(fun_type, user_id)`, `(user_id, is_sent)`,
`(created_at)`. On the local snapshot the Shops / Notifications aggregates return
in milliseconds, with zero load on production.

## Notes

- Data is the newest dump in the folder (≈1 day old) — expected for analytics.
- The swap is table-by-table `RENAME`, so the dashboard only blips momentarily at
  import time, then serves the fresh snapshot.
- The "last imported" marker lives in the `importstate` volume, so the
  skip-if-unchanged check survives restarts.
- The dashboard connects to local MySQL with `DB_SSL=false` (no TLS needed on the
  internal Docker network).
