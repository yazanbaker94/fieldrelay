#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
INFRA_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)
# shellcheck disable=SC2034 # Consumed by scripts that source this helper.
PROJECT_DIR=$(CDPATH= cd -- "$INFRA_DIR/.." && pwd -P)
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
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

POSTGRES_USER=${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}
POSTGRES_USER=${POSTGRES_USER:-fieldrelay}
POSTGRES_DB=${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}
POSTGRES_DB=${POSTGRES_DB:-fieldrelay}
