#!/usr/bin/env bash
# Deterministic import: take the NEWEST bis_backup_*.sql from a backups folder and
# load it into the local MySQL `app_bis` via a staging DB + atomic table swap.
# Exits non-zero with a clear ERROR message if no backup file is found, so Odysseus
# (run_script / ssh_command action) surfaces the error in the task session.
set -euo pipefail

: "${BACKUP_DIR:=/downloads}"              # mount the host Downloads folder here
: "${MYSQL_HOST:=host.docker.internal}"   # or the mysql service/container name
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:=root}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
: "${LIVE_DB:=app_bis}"
: "${STAGING_DB:=app_bis_import}"

log() { echo "[import $(date '+%F %T')] $*"; }
MYSQL=(mysql --skip-ssl -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "-p${MYSQL_PASSWORD}")

shopt -s nullglob
files=("$BACKUP_DIR"/bis_backup_*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "ERROR: No bis_backup_*.sql file found in ${BACKUP_DIR}" >&2
  exit 1
fi

newest="$(ls -t "$BACKUP_DIR"/bis_backup_*.sql | head -n1)"
log "Newest backup: $newest"

log "Recreating staging DB $STAGING_DB ..."
"${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$STAGING_DB\`; CREATE DATABASE \`$STAGING_DB\` CHARACTER SET utf8mb4;"

log "Importing into $STAGING_DB (may take a few minutes) ..."
sed -E '/^[[:space:]]*(CREATE DATABASE|USE )/Id' "$newest" | "${MYSQL[@]}" "$STAGING_DB"

log "Atomically swapping into live DB $LIVE_DB ..."
"${MYSQL[@]}" -e "CREATE DATABASE IF NOT EXISTS \`$LIVE_DB\` CHARACTER SET utf8mb4;"
tables="$("${MYSQL[@]}" -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$STAGING_DB' AND table_type='BASE TABLE';")"
swap=""
for t in $tables; do
  swap+="DROP TABLE IF EXISTS \`$LIVE_DB\`.\`$t\`; RENAME TABLE \`$STAGING_DB\`.\`$t\` TO \`$LIVE_DB\`.\`$t\`; "
done
[ -n "$swap" ] && "${MYSQL[@]}" -e "$swap"
"${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$STAGING_DB\`;"

log "Done. Row counts:"
"${MYSQL[@]}" "$LIVE_DB" -e "SELECT 'users' AS tbl, COUNT(*) AS n FROM users UNION ALL SELECT 'charges', COUNT(*) FROM charges UNION ALL SELECT 'variant_stock_notifications', COUNT(*) FROM variant_stock_notifications;"
