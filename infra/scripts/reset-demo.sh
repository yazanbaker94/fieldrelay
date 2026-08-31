#!/bin/sh
set -eu

SCRIPT_HOME=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
# shellcheck source=common.sh
. "$SCRIPT_HOME/common.sh"

confirmed=false
take_backup=true
for argument in "$@"; do
  case "$argument" in
    --yes) confirmed=true ;;
    --no-backup) take_backup=false ;;
    *)
      printf '%s\n' "Usage: $0 --yes [--no-backup]" >&2
      exit 2
      ;;
  esac
done

if [ "$confirmed" != true ]; then
  printf '%s\n' "This deletes every FieldRelay database record, then restores the synthetic demo seed." >&2
  printf '%s\n' "Re-run with --yes to confirm." >&2
  exit 2
fi

if [ "$take_backup" = true ]; then
  "$SCRIPT_DIR/backup-postgres.sh"
fi

restart_api=true
restart_on_exit() {
  if [ "$restart_api" = true ]; then
    compose up -d --no-deps api >/dev/null 2>&1 || true
  fi
}
trap restart_on_exit EXIT HUP INT TERM

compose stop api
compose exec -T db psql \
  --set ON_ERROR_STOP=1 \
  --set owner="$POSTGRES_USER" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO :"owner";
GRANT ALL ON SCHEMA public TO public;
SQL

compose run --rm --no-deps api node dist/cli/migrate.js
compose run --rm --no-deps api node dist/cli/seed.js
compose up -d --no-deps api

attempt=0
until compose exec -T api node -e "fetch('http://127.0.0.1:4100/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    printf '%s\n' "API did not become healthy after the reset." >&2
    exit 1
  fi
  sleep 2
done

restart_api=false
trap - EXIT HUP INT TERM
printf '%s\n' "FieldRelay demo restored to FR-2026-0842 / EX-0037."
