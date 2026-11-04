#!/bin/sh
# Nightly PostgreSQL + uploaded-photo backup with retention. Runs inside the "backup" container.
set -eu
mkdir -p /backups
backup() {
  stamp=$(date +%Y%m%d-%H%M%S)
  if pg_dump --format=custom --file="/backups/sstwas-$stamp.dump.tmp"; then
    mv "/backups/sstwas-$stamp.dump.tmp" "/backups/sstwas-$stamp.dump"
    tar -czf "/backups/uploads-$stamp.tar.gz" -C /uploads . 2>/dev/null || true
    echo "$(date -Iseconds) backup ok: sstwas-$stamp.dump"
  else
    rm -f "/backups/sstwas-$stamp.dump.tmp"; echo "$(date -Iseconds) BACKUP FAILED" >&2
  fi
  find /backups -name 'sstwas-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-30}" -delete
  find /backups -name 'uploads-*.tar.gz' -mtime +"${BACKUP_KEEP_DAYS:-30}" -delete
}
# One backup shortly after start (so a fresh install is protected immediately), then daily at BACKUP_HOUR.
sleep 60; backup
while true; do
  now=$(date +%s); hour=${BACKUP_HOUR:-2}
  next=$(date -d "$(date +%Y-%m-%d) $(printf %02d "$hour"):00:00" +%s 2>/dev/null || echo $((now+86400)))
  [ "$next" -le "$now" ] && next=$((next+86400))
  sleep $((next-now)); backup
done
