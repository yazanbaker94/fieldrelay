#!/bin/sh
set -eu

SCRIPT_HOME=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
# shellcheck source=common.sh
. "$SCRIPT_HOME/common.sh"

if [ "$#" -ne 2 ] || [ "$2" != "--yes" ]; then
  printf '%s\n' "Usage: $0 path/to/fieldrelay-backup.dump --yes" >&2
  exit 2
fi

backup_input=$1
if [ ! -f "$backup_input" ]; then
  printf '%s\n' "Backup does not exist: $backup_input" >&2
  exit 1
fi

backup_path=$(realpath -- "$backup_input")
case "$backup_path" in
  "$INFRA_DIR"/backups/*) ;;
  *)
    printf '%s\n' "Restore input must be inside $INFRA_DIR/backups" >&2
    exit 1
    ;;
esac

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

compose exec -T db pg_restore \
  --exit-on-error \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --no-owner \
  --no-acl < "$backup_path"

compose run --rm --no-deps api node dist/cli/migrate.js
compose up -d --no-deps api
restart_api=false
trap - EXIT HUP INT TERM
printf '%s\n' "Restored $backup_path"
