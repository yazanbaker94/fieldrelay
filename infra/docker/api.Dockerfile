FROM node:22.14.0-bookworm-slim AS build

WORKDIR /srv/fieldrelay-api

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/src ./src
COPY apps/api/migrations ./migrations

RUN npm run build \
  && npm prune --omit=dev

FROM node:22.14.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /srv/fieldrelay-api

COPY --from=build --chown=node:node /srv/fieldrelay-api/package.json ./package.json
COPY --from=build --chown=node:node /srv/fieldrelay-api/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /srv/fieldrelay-api/node_modules ./node_modules
COPY --from=build --chown=node:node /srv/fieldrelay-api/dist ./dist
COPY --from=build --chown=node:node /srv/fieldrelay-api/migrations ./migrations

USER node
EXPOSE 4100

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:4100/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Migrations and the deterministic demo seed are both idempotent.
CMD ["sh", "-c", "node dist/cli/migrate.js && node dist/cli/seed.js && exec node dist/server.js"]
