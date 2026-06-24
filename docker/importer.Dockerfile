# Nightly importer: pulls the dump from Google Drive (rclone), imports into a
# staging DB, adds indexes, then atomically swaps tables into the live DB.
FROM debian:stable-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      default-mysql-client rclone gzip unzip ca-certificates tzdata bash coreutils \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY docker/import.sh docker/entrypoint.sh /app/
COPY docker/indexes.sql /app/indexes.sql
RUN chmod +x /app/import.sh /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
