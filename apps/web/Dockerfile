# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/floor-plan-engine/package.json packages/floor-plan-engine/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/floor-plan-engine packages/floor-plan-engine
COPY apps/web apps/web

# The web app imports these workspace packages at build time.
RUN pnpm --filter @archai/shared build \
 && pnpm --filter @archai/floor-plan-engine build

# Baked at build time; the API URL the browser calls must be known here.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Opt into standalone output for the runtime image (safe here — Linux allows the
# symlinks that Windows blocks locally).
ENV NEXT_OUTPUT_STANDALONE=true
RUN pnpm --filter @archai/web build

# ── Runtime stage: Next.js standalone output ────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# `output: 'standalone'` with a monorepo tracing root emits a self-contained tree
# mirroring the repo layout: apps/web/server.js + a minimal traced node_modules.
# Static assets and public/ are not traced, so copy them alongside.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
