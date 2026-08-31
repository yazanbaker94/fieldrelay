#!/bin/sh
set -eu
umask 077

if [ "$#" -ne 4 ]; then
  printf '%s\n' "Usage: $0 operations.tgz release-id api-image@digest web-image@digest" >&2
  exit 2
fi

archive=$1
release_id=$2
api_image=$3
web_image=$4
deploy_root=${FIELDRELAY_DEPLOY_ROOT:-/opt/fieldrelay}
origin_port=${FIELDRELAY_ORIGIN_PORT:-18042}
host_caddy_env_file=${FIELDRELAY_HOST_CADDY_ENV_FILE:-}

if [ "$(id -u)" -ne 0 ]; then
  printf '%s\n' "FieldRelay deployment requires the existing root account or an approved equivalent wrapper." >&2
  exit 1
fi

# This deployment target is intentionally fixed to its reviewed isolated boundary.
# Changing it requires a fresh host audit.
if [ "$deploy_root" != /opt/fieldrelay ] || [ "$origin_port" != 18042 ]; then
  printf '%s\n' "Expected /opt/fieldrelay and loopback port 18042; refusing an unreviewed boundary." >&2
  exit 1
fi

case "$release_id" in
  ''|.|..|[!A-Za-z0-9]*|*[!A-Za-z0-9._-]*)
    printf '%s\n' "Release id contains unsupported characters." >&2
    exit 1
    ;;
esac

case "$api_image" in
  ghcr.io/yazanbaker94/fieldrelay-api@sha256:*) ;;
  *)
    printf '%s\n' "API image must be an immutable FieldRelay GHCR digest." >&2
    exit 1
    ;;
esac
api_digest=${api_image#ghcr.io/yazanbaker94/fieldrelay-api@sha256:}
if [ "${#api_digest}" -ne 64 ] || printf '%s' "$api_digest" | grep -q '[^0-9a-f]'; then
  printf '%s\n' "API image digest must contain exactly 64 lowercase hexadecimal characters." >&2
  exit 1
fi

case "$web_image" in
  ghcr.io/yazanbaker94/fieldrelay-web@sha256:*) ;;
  *)
    printf '%s\n' "Web image must be an immutable FieldRelay GHCR digest." >&2
    exit 1
    ;;
esac
web_digest=${web_image#ghcr.io/yazanbaker94/fieldrelay-web@sha256:}
if [ "${#web_digest}" -ne 64 ] || printf '%s' "$web_digest" | grep -q '[^0-9a-f]'; then
  printf '%s\n' "Web image digest must contain exactly 64 lowercase hexadecimal characters." >&2
  exit 1
fi

for command_name in awk caddy cat curl dirname docker flock grep install mktemp openssl readlink realpath stat systemctl tar; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s\n' "Missing required command: $command_name" >&2
    exit 1
  fi
done

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

test -f "$archive"
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  printf '%s\n' "Release archive contains an unsafe path." >&2
  exit 1
fi
if tar -tzf "$archive" | grep -Ev '^(infra|docs/deployment)(/|$)' | grep -q .; then
  printf '%s\n' "Release archive contains files outside infra/ and docs/deployment/." >&2
  exit 1
fi
if tar -tvzf "$archive" | awk '$1 !~ /^[-d]/ {found=1} END {exit !found}'; then
  printf '%s\n' "Release archive must contain only regular files and directories." >&2
  exit 1
fi

exec 9>/var/lock/fieldrelay-deploy.lock
if ! flock -w 120 9; then
  printf '%s\n' "Another FieldRelay deployment holds /var/lock/fieldrelay-deploy.lock." >&2
  exit 1
fi

releases_root="$deploy_root/releases"
shared_root="$deploy_root/shared"
env_file="$shared_root/fieldrelay.env"
backup_root="$shared_root/backups"
release_dir="$releases_root/$release_id"
current_link="$deploy_root/current"
next_link="$deploy_root/.current-$release_id.next"
site_file=/etc/caddy/sites/fieldrelay.caddy
ownership_marker="$deploy_root/.fieldrelay-deployment"
previous_release=
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

if [ -L "$deploy_root" ]; then
  printf '%s\n' "Deployment root must not be a symbolic link: $deploy_root" >&2
  exit 1
fi
if [ "$(realpath -m -- "$deploy_root")" != "$deploy_root" ]; then
  printf '%s\n' "Deployment root does not resolve to the reviewed boundary: $deploy_root" >&2
  exit 1
fi

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
    previous_release=$(validate_current_release "$current_link" "$releases_root")
  fi
else
  resource_report=$(fieldrelay_docker_resources)
  if [ -n "$resource_report" ]; then
    printf '%s\n' "Docker already contains resources reserved for Compose project fieldrelay:" >&2
    printf '%s\n' "$resource_report" >&2
    printf '%s\n' "Refusing to adopt or remove resources during a first installation." >&2
    exit 1
  fi
fi

for managed_dir in "$releases_root" "$shared_root" "$backup_root"; do
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

if [ -e "$env_file" ] || [ -L "$env_file" ]; then
  if [ ! -f "$env_file" ] || [ -L "$env_file" ] || [ "$(stat -c '%u' -- "$env_file")" -ne 0 ]; then
    printf '%s\n' "FieldRelay environment file must be a root-owned regular file: $env_file" >&2
    exit 1
  fi
elif [ -n "$previous_release" ]; then
  printf '%s\n' "Owned FieldRelay update is missing its shared environment file: $env_file" >&2
  exit 1
fi

if [ -e "$release_dir" ] || [ -L "$release_dir" ]; then
  printf '%s\n' "Release already exists: $release_dir" >&2
  exit 1
fi
if [ -e "$current_link" ] && [ ! -L "$current_link" ]; then
  printf '%s\n' "$current_link exists but is not a FieldRelay release symlink." >&2
  exit 1
fi
if [ -e "$next_link" ] || [ -L "$next_link" ]; then
  printf '%s\n' "Stale release-link candidate exists: $next_link" >&2
  exit 1
fi

mkdir -p "$releases_root" "$shared_root" "$backup_root"
if [ "$owned_install" != true ]; then
  printf '%s\n' FIELDRELAY_DEPLOYMENT_V1 > "$ownership_marker"
  chmod 0600 "$ownership_marker"
fi
chmod 0700 "$shared_root" "$backup_root"

stage_dir=$(mktemp -d "$releases_root/.stage.XXXXXX")
env_snapshot=
env_was_new=false
site_snapshot=
site_changed=false
release_started=false
release_dir_created=false
completed=false

cleanup() {
  result=$?
  trap - EXIT HUP INT TERM

  case "$stage_dir" in
    "$releases_root"/.stage.*)
      if [ -d "$stage_dir" ]; then
        rm -rf -- "$stage_dir"
      fi
      ;;
  esac

  if [ "$completed" != true ]; then
    if [ -n "$env_snapshot" ] && [ -f "$env_snapshot" ]; then
      cp "$env_snapshot" "$env_file"
      chmod 0600 "$env_file"
    elif [ "$env_was_new" = true ] && [ "$release_started" != true ]; then
      rm -f -- "$env_file"
    fi

    if [ "$site_changed" = true ]; then
      if [ -n "$site_snapshot" ] && [ -f "$site_snapshot" ]; then
        cp "$site_snapshot" "$site_file"
      else
        rm -f -- "$site_file"
      fi
      if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
        systemctl reload caddy || true
      fi
    fi

    if [ "$release_started" = true ] && [ -f "$env_file" ]; then
      if [ -n "$previous_release" ]; then
        docker compose -p fieldrelay --env-file "$env_file" -f "$previous_release/infra/compose.yaml" \
          up -d --no-build --wait --wait-timeout 180 >/dev/null 2>&1 || true
      elif [ -f "$release_dir/infra/compose.yaml" ]; then
        # First-install failure: stop only this isolated Compose project. Keep the
        # database volume and generated env for explicit recovery; never use -v.
        docker compose -p fieldrelay --env-file "$env_file" -f "$release_dir/infra/compose.yaml" down >/dev/null 2>&1 || true
      fi
    fi

    if [ "$release_dir_created" = true ]; then
      activated_release=
      if [ -L "$current_link" ]; then
        activated_release=$(readlink -f -- "$current_link" 2>/dev/null || :)
      fi
      if [ "$activated_release" != "$release_dir" ] && \
         [ "$(dirname -- "$release_dir")" = "$releases_root" ] && \
         [ -d "$release_dir" ] && [ ! -L "$release_dir" ]; then
        rm -rf -- "$release_dir"
      fi
    fi

    printf '%s\n' "Deployment stopped. Unrelated host services were not modified." >&2
  fi

  if [ -n "$env_snapshot" ] && [ -f "$env_snapshot" ]; then
    rm -f -- "$env_snapshot"
  fi
  if [ -n "$site_snapshot" ] && [ -f "$site_snapshot" ]; then
    rm -f -- "$site_snapshot"
  fi
  rm -f -- "$next_link"
  case "$archive" in
    /tmp/fieldrelay-operations-*.tgz) rm -f -- "$archive" ;;
  esac
  exit "$result"
}
trap cleanup EXIT HUP INT TERM

tar -xzf "$archive" -C "$stage_dir" --no-same-owner --no-same-permissions
test -f "$stage_dir/infra/compose.yaml"
test -f "$stage_dir/infra/caddy/host-site.caddy"
test -f "$stage_dir/infra/scripts/preflight-vps.sh"
test -f "$stage_dir/infra/scripts/healthcheck.sh"

FIELDRELAY_DEPLOY_ROOT="$deploy_root" FIELDRELAY_ORIGIN_PORT="$origin_port" \
  sh "$stage_dir/infra/scripts/preflight-vps.sh"

mv "$stage_dir" "$release_dir"
stage_dir=
release_dir_created=true

if [ -f "$env_file" ]; then
  env_snapshot=$(mktemp "$shared_root/.fieldrelay-env.previous.XXXXXX")
  cp "$env_file" "$env_snapshot"
else
  env_was_new=true
  postgres_password=$(openssl rand -hex 32)
  {
    printf '%s\n' 'FIELDRELAY_DOMAIN=fieldrelay.swoop.video'
    printf '%s\n' 'FIELDRELAY_ORIGIN_PORT=18042'
    printf '%s\n' 'FIELDRELAY_DEPLOY_ROOT=/opt/fieldrelay'
    printf '%s\n' 'FIELDRELAY_BACKUP_DIR=/opt/fieldrelay/shared/backups'
    printf '%s\n' 'POSTGRES_DB=fieldrelay'
    printf '%s\n' 'POSTGRES_USER=fieldrelay'
    printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
    printf 'DATABASE_URL=postgresql://fieldrelay:%s@db:5432/fieldrelay\n' "$postgres_password"
    printf '%s\n' 'LOG_LEVEL=info'
    printf '%s\n' 'CORS_ORIGIN=https://fieldrelay.swoop.video'
    printf '%s\n' 'ALLOW_CANONICAL_MUTATIONS=false'
    printf '%s\n' 'PUBLIC_WRITE_LIMIT_PER_HOUR=120'
    printf '%s\n' 'MAX_DEMO_RUNS=500'
    printf '%s\n' 'MAX_SSE_CONNECTIONS_PER_CLIENT=3'
    printf '%s\n' 'MAX_SSE_CONNECTIONS_GLOBAL=100'
    printf '%s\n' 'DELIVERY_DESTINATION_TYPE=GENERIC_WEBHOOK'
    printf '%s\n' 'DELIVERY_DESTINATION_NAME=ERP Demo / Generic Webhook'
    printf '%s\n' 'DELIVERY_DESTINATION_URL=local://delivery-simulator'
    printf '%s\n' 'BACKUP_RETENTION_DAYS=14'
  } > "$env_file"
  unset postgres_password
  chmod 0600 "$env_file"
fi

set_env_value() {
  env_key=$1
  env_value=$2
  env_next=$(mktemp "$shared_root/.fieldrelay-env.next.XXXXXX")
  awk -v key="$env_key" -v value="$env_value" '
    BEGIN { found = 0 }
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$env_file" > "$env_next"
  chmod 0600 "$env_next"
  mv "$env_next" "$env_file"
}

set_env_value FIELDRELAY_API_IMAGE "$api_image"
set_env_value FIELDRELAY_WEB_IMAGE "$web_image"
set_env_value FIELDRELAY_DEPLOY_ROOT "$deploy_root"
set_env_value FIELDRELAY_BACKUP_DIR "$backup_root"
set_env_value FIELDRELAY_ORIGIN_PORT "$origin_port"

ln -s "$env_file" "$release_dir/infra/.env"

if [ -n "$previous_release" ]; then
  previous_db_ids=$(docker compose -p fieldrelay --env-file "$env_file" \
    -f "$previous_release/infra/compose.yaml" ps --status running --quiet db)
  previous_db_count=$(printf '%s\n' "$previous_db_ids" | awk 'NF { count += 1 } END { print count + 0 }')
  if [ "$previous_db_count" -ne 1 ]; then
    printf '%s\n' "Owned FieldRelay update requires exactly one running database container before backup." >&2
    exit 1
  fi
  FIELDRELAY_ENV_FILE="$env_file" FIELDRELAY_DEPLOY_ROOT="$deploy_root" FIELDRELAY_BACKUP_DIR="$backup_root" \
    sh "$previous_release/infra/scripts/backup-postgres.sh"
fi

docker compose -p fieldrelay --env-file "$env_file" -f "$release_dir/infra/compose.yaml" config --quiet
docker compose -p fieldrelay --env-file "$env_file" -f "$release_dir/infra/compose.yaml" pull db api web caddy
release_started=true
docker compose -p fieldrelay --env-file "$env_file" -f "$release_dir/infra/compose.yaml" \
  up -d --no-build --wait --wait-timeout 180

FIELDRELAY_ENV_FILE="$env_file" FIELDRELAY_DEPLOY_ROOT="$deploy_root" FIELDRELAY_BACKUP_DIR="$backup_root" \
  sh "$release_dir/infra/scripts/healthcheck.sh"
curl -fsS --max-time 10 "http://127.0.0.1:$origin_port/health" >/dev/null
curl -fsS --max-time 10 "http://127.0.0.1:$origin_port/ready" >/dev/null
curl -fsS --max-time 10 "http://127.0.0.1:$origin_port/" >/dev/null

if [ -f "$site_file" ]; then
  site_snapshot=$(mktemp "$shared_root/.fieldrelay-site.previous.XXXXXX")
  cp "$site_file" "$site_snapshot"
fi
install -o root -g root -m 0644 "$release_dir/infra/caddy/host-site.caddy" "$site_file"
site_changed=true
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"

completed=true
printf '%s\n' "FieldRelay origin deployment complete: $release_id"
printf '%s\n' "Origin verified on 127.0.0.1:$origin_port; public DNS/TLS verification remains separate."
