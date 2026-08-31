#!/bin/sh
set -eu

# Read-only validation for a shared VPS. This script must not
# create files, restart services, pull images, or alter firewall/Caddy state.

origin_port=${FIELDRELAY_ORIGIN_PORT:-18042}
deploy_root=${FIELDRELAY_DEPLOY_ROOT:-/opt/fieldrelay}
host_caddy_env_file=${FIELDRELAY_HOST_CADDY_ENV_FILE:-}

case "$origin_port" in
  ''|*[!0-9]*)
    printf '%s\n' "FIELDRELAY_ORIGIN_PORT must be numeric." >&2
    exit 1
    ;;
esac
if [ "$origin_port" -lt 1024 ] || [ "$origin_port" -gt 65535 ]; then
  printf '%s\n' "FIELDRELAY_ORIGIN_PORT must be between 1024 and 65535." >&2
  exit 1
fi

case "$deploy_root" in
  /|/bin|/boot|/dev|/etc|/home|/opt|/root|/run|/srv|/tmp|/usr|/var)
    printf '%s\n' "Refusing broad deployment root: $deploy_root" >&2
    exit 1
    ;;
  /*) ;;
  *)
    printf '%s\n' "Deployment root must be absolute: $deploy_root" >&2
    exit 1
    ;;
esac

for command_name in awk caddy cat df dirname docker flock grep id openssl readlink realpath ss stat systemctl tar; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s\n' "Missing required command: $command_name" >&2
    exit 1
  fi
done

if [ -L "$deploy_root" ]; then
  printf '%s\n' "Deployment root must not be a symbolic link: $deploy_root" >&2
  exit 1
fi

deploy_root=$(realpath -m -- "$deploy_root")
case "$deploy_root" in
  /|/bin|/boot|/dev|/etc|/home|/opt|/root|/run|/srv|/tmp|/usr|/var)
    printf '%s\n' "Refusing broad canonical deployment root: $deploy_root" >&2
    exit 1
    ;;
esac

if [ "$(id -u)" -ne 0 ]; then
  printf '%s\n' "Deployment requires the existing root SSH account or an approved equivalent wrapper." >&2
  exit 1
fi

docker compose version >/dev/null
if ! docker compose up --help | grep -q -- '--wait'; then
  printf '%s\n' "Docker Compose must support bounded startup waiting with --wait." >&2
  exit 1
fi
systemctl is-active --quiet docker
systemctl is-active --quiet caddy

# A shared host may need protected values to validate its complete Caddy graph.
# The path is supplied only by the operator and is never printed or copied.
if [ -n "$host_caddy_env_file" ]; then
  case "$host_caddy_env_file" in
    /*) ;;
    *)
      printf '%s\n' "FIELDRELAY_HOST_CADDY_ENV_FILE must be an absolute path." >&2
      exit 1
      ;;
  esac
  if [ ! -f "$host_caddy_env_file" ] || [ -L "$host_caddy_env_file" ] || \
     [ "$(stat -c '%u' -- "$host_caddy_env_file")" -ne 0 ]; then
    printf '%s\n' "Host Caddy environment file must be a root-owned regular file." >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$host_caddy_env_file"
  set +a
fi
caddy validate --config /etc/caddy/Caddyfile >/dev/null

if ! grep -Eq '^import[[:space:]]+/etc/caddy/sites/\*\.caddy[[:space:]]*$' /etc/caddy/Caddyfile; then
  printf '%s\n' "Host Caddy does not import /etc/caddy/sites/*.caddy; refusing to alter its main config." >&2
  exit 1
fi

ownership_marker="$deploy_root/.fieldrelay-deployment"
releases_root="$deploy_root/releases"
current_link="$deploy_root/current"
owned_install=false

validate_current_release() {
  release_link=$1
  release_root=$2

  if [ ! -L "$release_link" ]; then
    printf '%s\n' "$release_link must be a FieldRelay release symlink." >&2
    return 1
  fi

  release_target=$(readlink -f -- "$release_link") || {
    printf '%s\n' "Could not resolve FieldRelay release symlink: $release_link" >&2
    return 1
  }
  if [ ! -d "$release_target" ] || [ "$(dirname -- "$release_target")" != "$release_root" ]; then
    printf '%s\n' "FieldRelay current release escapes $release_root: $release_target" >&2
    return 1
  fi
  if [ "$(stat -c '%u' -- "$release_target")" -ne 0 ]; then
    printf '%s\n' "FieldRelay current release is not root-owned: $release_target" >&2
    return 1
  fi

  for required_relative in \
    infra/compose.yaml \
    infra/scripts/backup-postgres.sh \
    infra/scripts/common.sh \
    infra/scripts/healthcheck.sh
  do
    required_path="$release_target/$required_relative"
    if [ ! -f "$required_path" ] || [ -L "$required_path" ]; then
      printf '%s\n' "FieldRelay current release is missing a regular $required_relative." >&2
      return 1
    fi
    required_canonical=$(realpath -e -- "$required_path") || return 1
    case "$required_canonical" in
      "$release_target"/*) ;;
      *)
        printf '%s\n' "FieldRelay release file escapes its release directory: $required_path" >&2
        return 1
        ;;
    esac
    if [ "$(stat -c '%u' -- "$required_canonical")" -ne 0 ]; then
      printf '%s\n' "FieldRelay release file is not root-owned: $required_path" >&2
      return 1
    fi
  done

  printf '%s\n' "$release_target"
}

fieldrelay_docker_resources() {
  docker ps -a \
    --filter label=com.docker.compose.project=fieldrelay \
    --format 'container {{.Names}}'
  docker ps -a --format '{{.Names}}' | \
    awk '/^fieldrelay([-_]|$)/ { print "named container " $0 }'
  docker network ls \
    --filter label=com.docker.compose.project=fieldrelay \
    --format 'network {{.Name}}'
  docker network ls --format '{{.Name}}' | \
    awk '/^fieldrelay([-_]|$)/ { print "named network " $0 }'
  docker volume ls \
    --filter label=com.docker.compose.project=fieldrelay \
    --format 'volume {{.Name}}'
  docker volume ls --format '{{.Name}}' | \
    awk '/^fieldrelay([-_]|$)/ { print "named volume " $0 }'
}

if [ -e "$deploy_root" ]; then
  if [ ! -d "$deploy_root" ] || [ "$(stat -c '%u' -- "$deploy_root")" -ne 0 ] || \
     [ ! -f "$ownership_marker" ] || [ -L "$ownership_marker" ] || \
     [ "$(stat -c '%u' -- "$ownership_marker")" -ne 0 ] || \
     [ "$(cat -- "$ownership_marker")" != FIELDRELAY_DEPLOYMENT_V1 ]; then
    printf '%s\n' "$deploy_root exists without the root-owned FieldRelay V1 ownership marker." >&2
    exit 1
  fi
  owned_install=true
  if [ -e "$current_link" ] || [ -L "$current_link" ]; then
    validate_current_release "$current_link" "$releases_root" >/dev/null
  fi

  for managed_dir in "$releases_root" "$deploy_root/shared" "$deploy_root/shared/backups"; do
    if [ -L "$managed_dir" ]; then
      printf '%s\n' "Managed FieldRelay directory must not be a symbolic link: $managed_dir" >&2
      exit 1
    fi
    if [ -e "$managed_dir" ] && \
       { [ ! -d "$managed_dir" ] || [ "$(stat -c '%u' -- "$managed_dir")" -ne 0 ]; }; then
      printf '%s\n' "Managed FieldRelay path is not a root-owned directory: $managed_dir" >&2
      exit 1
    fi
  done

  env_file="$deploy_root/shared/fieldrelay.env"
  if [ -e "$env_file" ] || [ -L "$env_file" ]; then
    if [ ! -f "$env_file" ] || [ -L "$env_file" ] || [ "$(stat -c '%u' -- "$env_file")" -ne 0 ]; then
      printf '%s\n' "FieldRelay environment file must be a root-owned regular file: $env_file" >&2
      exit 1
    fi
  elif [ -e "$current_link" ] || [ -L "$current_link" ]; then
    printf '%s\n' "Owned FieldRelay update is missing its shared environment file: $env_file" >&2
    exit 1
  fi
fi

resource_report=$(fieldrelay_docker_resources)
if [ -n "$resource_report" ] && [ "$owned_install" != true ]; then
  printf '%s\n' "Docker already contains resources reserved for Compose project fieldrelay:" >&2
  printf '%s\n' "$resource_report" >&2
  printf '%s\n' "Refusing to adopt or remove resources without a proven FieldRelay-owned installation." >&2
  exit 1
fi

site_file=/etc/caddy/sites/fieldrelay.caddy
if [ -e "$site_file" ] || [ -L "$site_file" ]; then
  if [ ! -f "$site_file" ] || [ -L "$site_file" ] || \
     [ "$(stat -c '%u' -- "$site_file")" -ne 0 ] || \
     ! grep -Fxq '# FIELDRELAY_HOST_SITE_V1' "$site_file"; then
    printf '%s\n' "$site_file exists without the root-owned FieldRelay ownership marker." >&2
    exit 1
  fi
fi

listener_addresses=$(ss -ltnH | awk -v port="$origin_port" '$4 ~ (":" port "$") {print $4}')
if [ -n "$listener_addresses" ]; then
  if printf '%s\n' "$listener_addresses" | grep -Ev "^127\\.0\\.0\\.1:${origin_port}$" | grep -q .; then
    printf '%s\n' "Port $origin_port has a non-loopback listener; refusing the shared-host deployment." >&2
    exit 1
  fi

  fieldrelay_caddy_ids=$(docker ps \
    --filter label=com.docker.compose.project=fieldrelay \
    --filter label=com.docker.compose.service=caddy \
    --format '{{.ID}}')
  # shellcheck disable=SC2086 # Intentional word splitting counts container ids.
  set -- $fieldrelay_caddy_ids
  if [ "$#" -ne 1 ]; then
    printf '%s\n' "Loopback port $origin_port is not owned by exactly one FieldRelay Caddy container." >&2
    exit 1
  fi
  published_binding=$(docker inspect --format '{{range (index .HostConfig.PortBindings "8080/tcp")}}{{.HostIp}}:{{.HostPort}}{{end}}' "$1")
  if [ "$published_binding" != "127.0.0.1:$origin_port" ]; then
    printf '%s\n' "FieldRelay Caddy has an unexpected published binding: $published_binding" >&2
    exit 1
  fi
  printf '%s\n' "FieldRelay loopback origin already present on 127.0.0.1:$origin_port."
else
  printf '%s\n' "Loopback origin port 127.0.0.1:$origin_port is available."
fi

available_kib=$(df -Pk /opt | awk 'NR == 2 {print $4}')
if [ "${available_kib:-0}" -lt 5242880 ]; then
  printf '%s\n' "At least 5 GiB free under /opt is required." >&2
  exit 1
fi

memory_kib=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
if [ "${memory_kib:-0}" -lt 2097152 ]; then
  printf '%s\n' "At least 2 GiB RAM is required." >&2
  exit 1
fi

printf '%s\n' "VPS preflight passed without changes."
printf '%s\n' "Boundary: $deploy_root, Compose project fieldrelay, loopback origin 127.0.0.1:$origin_port, Caddy drop-in /etc/caddy/sites/fieldrelay.caddy."
printf '%s\n' "Protected services remain outside this boundary: audiofetcher.com, ytmp3-api@8080/8081, rook-compliance, and the host Caddy main file."
