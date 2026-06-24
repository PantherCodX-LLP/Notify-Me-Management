#!/usr/bin/env bash
# Pull the LATEST dump from a Google Drive folder and load it into local MySQL.
# If the newest file hasn't changed since the last successful import, it skips
# and keeps the current snapshot. READ ONLY against Drive (rclone copy only).
set -euo pipefail

: "${MYSQL_HOST:=mysql}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
: "${LIVE_DB:=app_bis}"
: "${STAGING_DB:=app_bis_import}"
: "${GDRIVE_REMOTE:=gdrive}"
: "${GDRIVE_FOLDER_ID:?GDRIVE_FOLDER_ID is required (the shared Drive folder id)}"
: "${FILE_PATTERN:=\.(sql|sql\.gz|zip)$}"

WORK=/tmp/import
STATE=/state
MARKER="$STATE/last_import.txt"
RCLONE=(rclone --config /config/rclone.conf)
BASE="${GDRIVE_REMOTE},root_folder_id=${GDRIVE_FOLDER_ID}:"
MYSQL=(mysql --skip-ssl --host="$MYSQL_HOST" --user=root "--password=${MYSQL_ROOT_PASSWORD}")

log() { echo "[import $(date '+%F %T')] $*"; }

mkdir -p "$STATE"
rm -rf "$WORK"; mkdir -p "$WORK"

# 1) find the newest matching file in the folder:  "<modtime>|<relpath>"
log "Listing $BASE ..."
LISTING="$("${RCLONE[@]}" lsf -R --files-only --format "tp" --separator "|" "$BASE" \
            | grep -iE "$FILE_PATTERN" || true)"
if [ -z "$LISTING" ]; then
  log "ERROR: no .sql/.sql.gz/.zip files found in the Drive folder."
  exit 1
fi
NEWEST="$(printf '%s\n' "$LISTING" | sort -t'|' -k1,1r | head -n1)"
MODTIME="${NEWEST%%|*}"
REL="${NEWEST#*|}"
SIG="${REL}|${MODTIME}"
log "Newest file: $REL  (modified $MODTIME)"

# 2) skip if unchanged since last successful import
if [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$SIG" ]; then
  log "No new file since last import — keeping the current snapshot. Done."
  exit 0
fi

# 3) download just that file
NAME="$(basename "$REL")"
log "Downloading $REL ..."
"${RCLONE[@]}" copyto "${BASE}${REL}" "$WORK/$NAME"

SQL="$WORK/$NAME"
case "$NAME" in
  *.gz)  gunzip -f "$SQL"; SQL="${SQL%.gz}";;
  *.zip) (cd "$WORK" && unzip -o "$NAME" >/dev/null); SQL="$(ls -1 "$WORK"/*.sql | head -n1)";;
esac
log "Using SQL file: $SQL"

# 4) import into a fresh staging DB (strip CREATE DATABASE / USE just in case)
log "Recreating staging database $STAGING_DB ..."
"${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$STAGING_DB\`; CREATE DATABASE \`$STAGING_DB\` CHARACTER SET utf8mb4;"
log "Importing into $STAGING_DB (can take a few minutes for large dumps) ..."
sed -E '/^\s*(CREATE DATABASE|USE )/Id' "$SQL" | "${MYSQL[@]}" "$STAGING_DB"

log "Adding performance indexes ..."
"${MYSQL[@]}" --force "$STAGING_DB" < /app/indexes.sql || true

# 5) atomically swap staging -> live (table by table)
log "Swapping into live database $LIVE_DB ..."
"${MYSQL[@]}" -e "CREATE DATABASE IF NOT EXISTS \`$LIVE_DB\` CHARACTER SET utf8mb4;"
TABLES="$("${MYSQL[@]}" -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$STAGING_DB' AND table_type='BASE TABLE';")"
SWAP=""
for t in $TABLES; do
  SWAP+="DROP TABLE IF EXISTS \`$LIVE_DB\`.\`$t\`; RENAME TABLE \`$STAGING_DB\`.\`$t\` TO \`$LIVE_DB\`.\`$t\`; "
done
[ -n "$SWAP" ] && "${MYSQL[@]}" -e "$SWAP"
"${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$STAGING_DB\`;"

# 6) record what we imported so we can skip next time if unchanged
printf '%s' "$SIG" > "$MARKER"
rm -rf "$WORK"
log "Import complete. Live DB '$LIVE_DB' refreshed from $NAME."
