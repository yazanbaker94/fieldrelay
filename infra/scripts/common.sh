#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
INFRA_DIR=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd -P)
# shellcheck disable=SC2034 # Consumed by scripts that source this helper.
PROJECT_DIR=$(CDPATH='' cd -- "$INFRA_DIR/.." && pwd -P)
COMPOSE_FILE="$INFRA_DIR/compose.yaml"
ENV_FILE=${FIELDRELAY_ENV_FILE:-"$INFRA_DIR/.env"}

if [ ! -f "$ENV_FILE" ]; then
  printf '%s\n' "Missing $ENV_FILE. Copy infra/.env.example to infra/.env and replace every placeholder." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' "Docker is required." >&2
  exit 1
fi

read_env_value() {
  key=$1
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r'
}

compose() {
  # The explicit project name wins over COMPOSE_PROJECT_NAME in any stale or
  # operator-supplied env file, so this stack can never target a neighbour.
  docker compose -p fieldrelay --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

DEPLOY_ROOT=${FIELDRELAY_DEPLOY_ROOT:-$(read_env_value FIELDRELAY_DEPLOY_ROOT)}
DEPLOY_ROOT=${DEPLOY_ROOT:-"$PROJECT_DIR"}
if ! command -v realpath >/dev/null 2>&1; then
  printf '%s\n' "GNU realpath is required for deployment-path validation." >&2
  exit 1
fi
DEPLOY_ROOT=$(realpath -m -- "$DEPLOY_ROOT")
case "$DEPLOY_ROOT" in
  /|/bin|/boot|/dev|/etc|/home|/opt|/root|/run|/srv|/tmp|/usr|/var)
    printf '%s\n' "FIELDRELAY_DEPLOY_ROOT is too broad: $DEPLOY_ROOT" >&2
    exit 1
    ;;
  /*) ;;
  *)
    printf '%s\n' "FIELDRELAY_DEPLOY_ROOT must be an absolute path: $DEPLOY_ROOT" >&2
    exit 1
    ;;
esac

BACKUP_ROOT=${FIELDRELAY_BACKUP_DIR:-$(read_env_value FIELDRELAY_BACKUP_DIR)}
BACKUP_ROOT=${BACKUP_ROOT:-"$INFRA_DIR/backups"}
BACKUP_ROOT=$(realpath -m -- "$BACKUP_ROOT")
case "$BACKUP_ROOT" in
  "$DEPLOY_ROOT"/*) ;;
  *)
    printf '%s\n' "Backup directory must remain inside $DEPLOY_ROOT" >&2
    exit 1
    ;;
esac

POSTGRES_USER=${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}
POSTGRES_USER=${POSTGRES_USER:-fieldrelay}
POSTGRES_DB=${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}
POSTGRES_DB=${POSTGRES_DB:-fieldrelay}
