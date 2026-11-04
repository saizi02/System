#!/bin/sh
# Restore a backup:  ./deploy/restore.sh backups/sstwas-20261103-020000.dump
# Replaces ALL current data. Stop customers first (docker compose stop app proxy).
set -eu
f="${1:?usage: deploy/restore.sh backups/sstwas-YYYYMMDD-HHMMSS.dump}"
[ -f "$f" ] || { echo "No such file: $f"; exit 1; }
printf 'This will REPLACE all current data with %s. Type YES to continue: ' "$f"; read a; [ "$a" = "YES" ] || exit 1
docker compose stop app proxy
docker compose exec -T db sh -c 'dropdb -U sstwas --if-exists sstwas && createdb -U sstwas sstwas'
docker compose exec -T db pg_restore -U sstwas -d sstwas --no-owner < "$f"
docker compose start app proxy
echo "Restore complete."
