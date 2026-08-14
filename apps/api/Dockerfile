# ── Build stage: full monorepo, compile api + its workspace deps ─────────────
FROM node:22-bookworm-slim AS build
WORKDIR /repo

RUN corepack enable

# Manifests first for a cached install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/floor-plan-engine/package.json packages/floor-plan-engine/
COPY packages/ai/package.json packages/ai/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# Sources.
COPY packages/shared packages/shared
COPY packages/floor-plan-engine packages/floor-plan-engine
COPY packages/ai packages/ai
COPY apps/api apps/api

RUN pnpm --filter @archai/shared build \
 && pnpm --filter @archai/floor-plan-engine build \
 && pnpm --filter @archai/ai build \
 && pnpm --filter @archai/api exec prisma generate \
 && pnpm --filter @archai/api build

# Deploy the api as a self-contained tree in /out. `pnpm deploy` rebuilds
# node_modules from the lockfile, which does NOT carry the generated Prisma
# client (a post-install artifact), so regenerate it from *inside* /out where
# its own prisma CLI and @prisma/client resolve consistently. Kept non-pruned so
# that CLI is present; the tradeoff is a larger image than a --prod prune.
RUN pnpm --filter @archai/api deploy /out \
 && cd /out \
 && node_modules/.bin/prisma generate

# ── Runtime stage: minimal, non-root ────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# The pruned deploy carries node_modules, dist and prisma; copy the built assets
# (fonts for PDF) and the Prisma schema/migrations for `migrate deploy` at boot.
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/prisma ./prisma
COPY --from=build /repo/apps/api/assets ./assets

USER node
EXPOSE 3001
# Migrations run as a separate one-shot service (see docker-compose.prod.yml),
# which uses the `build` stage where the Prisma CLI is present — the pruned
# runtime deps here intentionally exclude it. The app just serves.
CMD ["node", "dist/main.js"]
