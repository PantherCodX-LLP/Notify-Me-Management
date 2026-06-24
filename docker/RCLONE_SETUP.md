# Fix the importer — set up rclone Google Drive access

Importer error:
    Failed to load config file "/config/rclone.conf": is a directory
    ERROR: no .sql/.sql.gz/.zip files found in the Drive folder.

Cause: `docker/rclone.conf` got created as an empty FOLDER, and there were no
Google Drive credentials. Fix both.

## 1. Stop importer and delete the bad folder (PowerShell)
    docker compose stop importer
    Remove-Item -Recurse -Force ".\docker\rclone.conf"

## 2. Authenticate rclone to Google Drive (one time)
Use the Google account the backup folder is SHARED WITH.
1. Download rclone: https://rclone.org/downloads/  (unzip rclone.exe)
2. Run:  .\rclone.exe config
3. Answers: n  -> name: gdrive  -> Storage: drive  -> client_id/secret: blank
   -> scope: 2 (read-only) -> service_account_file: blank -> advanced: n
   -> auto config: y (browser opens, log in + Allow) -> Team Drive: n -> y -> q
4. Show config path:  .\rclone.exe config file
   (usually C:\Users\Tej\AppData\Roaming\rclone\rclone.conf)

## 3. Put the config where the importer expects it (a FILE)
    copy "C:\Users\Tej\AppData\Roaming\rclone\rclone.conf" ".\docker\rclone.conf"
Confirm it is a file (Mode should not start with d):
    Get-Item ".\docker\rclone.conf"

## 4. Restart and watch
    docker compose up -d importer
    docker compose logs -f importer

## Quick test (prove access first)
    .\rclone.exe --config ".\docker\rclone.conf" lsf "gdrive,root_folder_id=11hiUAwq5W4XW1hIAmETKHnHi5tkHjVI3:"
You should see the .sql backup filenames.

## Alternative: service account (no browser)
1. Create a Google Cloud service account, download its JSON key.
2. Share the Drive folder with the service account email (Viewer).
3. docker/rclone.conf:
       [gdrive]
       type = drive
       scope = drive.readonly
       service_account_file = /config/sa.json
   and mount the JSON to /config/sa.json in docker-compose.yml.
