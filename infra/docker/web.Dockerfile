FROM node:22.23.2-bookworm-slim AS build

ENV WRANGLER_SEND_METRICS=false \
    WRANGLER_WRITE_LOGS=false
WORKDIR /srv/fieldrelay-web

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

COPY apps/web/ ./
RUN npm run build

FROM node:22.23.2-bookworm-slim AS runtime

ENV NODE_ENV=production \
    WRANGLER_SEND_METRICS=false \
    WRANGLER_WRITE_LOGS=false \
    WRANGLER_LOG_PATH=/tmp/wrangler/logs \
    MINIFLARE_REGISTRY_PATH=/tmp/miniflare/registry
WORKDIR /srv/fieldrelay-web

# Vinext's generated server is a Workers-compatible bundle. Wrangler supplies the
# local Workers runtime on a conventional VPS; no Cloudflare account is required.
COPY --from=build --chown=node:node /srv/fieldrelay-web/package.json ./package.json
COPY --from=build --chown=node:node /srv/fieldrelay-web/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /srv/fieldrelay-web/node_modules ./node_modules
COPY --from=build --chown=node:node /srv/fieldrelay-web/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/wrangler", "dev", "--config", "dist/server/wrangler.json", "--ip", "0.0.0.0", "--port", "3000", "--log-level", "warn"]
