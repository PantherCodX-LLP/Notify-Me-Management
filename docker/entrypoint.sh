#!/usr/bin/env bash
set -euo pipefail
: "${IMPORT_HOUR:=8}"
: "${IMPORT_MINUTE:=30}"

run_import() { /app/import.sh || echo "[scheduler] import failed; will try again next cycle"; }

# Wait for MySQL to be reachable before the first run.
for i in $(seq 1 60); do
  if mysql --skip-ssl --host="${MYSQL_HOST:-mysql}" --user=root "--password=${MYSQL_ROOT_PASSWORD}" -e "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  echo "[scheduler] waiting for MySQL... ($i)"; sleep 5
done

if [ "${IMPORT_ON_START:-false}" = "true" ]; then
  echo "[scheduler] running initial import on start"
  run_import
fi

while true; do
  now=$(date +%s)
  target=$(date -d "today ${IMPORT_HOUR}:${IMPORT_MINUTE}:00" +%s)
  [ "$target" -le "$now" ] && target=$(date -d "tomorrow ${IMPORT_HOUR}:${IMPORT_MINUTE}:00" +%s)
  wait_s=$(( target - now ))
  echo "[scheduler] next import at ${IMPORT_HOUR}:${IMPORT_MINUTE} (in ${wait_s}s)"
  sleep "$wait_s"
  run_import
done
