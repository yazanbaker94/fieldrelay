#!/bin/sh
set -eu

SCRIPT_HOME=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
# shellcheck source=common.sh
. "$SCRIPT_HOME/common.sh"

compose ps
compose exec -T api node -e "fetch('http://127.0.0.1:4100/health').then(async r=>{if(!r.ok)process.exit(1); console.log(await r.text())}).catch(error=>{console.error(error);process.exit(1)})"
compose exec -T api node -e "fetch('http://127.0.0.1:4100/ready').then(async r=>{if(!r.ok)process.exit(1); console.log(await r.text())}).catch(error=>{console.error(error);process.exit(1)})"
compose exec -T web node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1); console.log('web',r.status)}).catch(error=>{console.error(error);process.exit(1)})"
compose exec -T caddy wget -q -O - http://127.0.0.1:8080/healthz
