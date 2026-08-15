# Deployment

## Production images (validated)

Two multi-stage Docker images, both built from the repo root context:

- `apps/api/Dockerfile` — NestJS API. Builds the workspace packages, generates the Prisma
  client, compiles, then `pnpm deploy`s a self-contained tree and regenerates the Prisma
  client inside it (the deploy step rebuilds node_modules without the generated client).
  Runtime is non-root `node`, `CMD node dist/main.js`. Bundles the Manrope fonts for PDF.
- `apps/web/Dockerfile` — Next.js. Builds workspace deps + the app with `output: 'standalone'`
  (tracing root = repo root, so workspace packages are bundled), runtime copies
  `.next/standalone` + `.next/static` + `public`, `CMD node apps/web/server.js`, non-root.
  `NEXT_PUBLIC_API_URL` is a build arg — baked at build time (the browser calls it directly).

Both images were smoke-tested in this repo: the API boots and serves `/health` (`db:up`)
against a live database; the web image serves `/login` (200) with the security headers.

## Compose (production)

`docker-compose.prod.yml` orchestrates postgres + a one-shot `migrate` service (runs
`prisma migrate deploy` from the build stage, which has the Prisma CLI) + api + web. The api
waits for migration to complete (`service_completed_successfully`) and for postgres health.
Secrets come from a `.env` beside the compose file — never committed. Required keys:

```
POSTGRES_PASSWORD=…
DATABASE_URL=postgresql://archai:…@postgres:5432/archai?schema=public
WEB_ORIGIN=https://your-domain
NEXT_PUBLIC_API_URL=https://api.your-domain
JWT_ACCESS_SECRET=…            # 64+ random chars
JWT_REFRESH_SECRET=…           # different 64+ random chars
AI_PROVIDER=gemini             # gemini | groq | mock
AI_FALLBACK_PROVIDER=groq      # runtime fallback, or none
GEMINI_API_KEY=                # primary; AI degrades to an honest 503 when empty
GROQ_API_KEY=                  # fallback provider key
AI_MAX_REQUESTS_PER_USER_PER_DAY=20   # per-user daily quota (0 = off)
```

`COOKIE_SECURE` is forced `true` in the compose (HTTPS assumed in production). Put a
TLS-terminating reverse proxy in front of both services.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Seeding

The seed refuses to run in production unless `ALLOW_PROD_SEED=true` (it plants a
repo-published demo/admin password). Only enable it for an intentional demo deployment, and
change those passwords immediately after.

## CI

`.github/workflows-pending/ci.yml` runs install → shared build → prisma generate → lint →
typecheck → tests (with a service Postgres) → builds. It is not yet at
`.github/workflows/` because pushing workflow files needs the GitHub token's `workflow`
scope: `gh auth refresh -h github.com -s workflow`, then move the file into
`.github/workflows/` and push.

## Environment

`.env.example` documents every key; the API validates required env at startup (zod, fails
fast). Dev uses `docker-compose.yml` (Postgres only, host port 5433).
