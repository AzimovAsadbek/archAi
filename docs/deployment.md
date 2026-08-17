# Deployment

Two supported targets: **Vercel + Neon** (serverless, below) and **Docker Compose**
(long-running containers, further down). They share the same code; only the entry point
and the database differ.

## Vercel + Neon

### Shape

Two Vercel projects from this one repository, and **one origin in the browser**:

```
browser ──► archai-web (apps/web)  ──rewrite──►  archai-api (apps/api)  ──►  Neon
            Next.js                 server-side   NestJS on a Node function
```

The browser never calls the API directly. `next.config.ts` rewrites `/api/v1/*` to the API
deployment, so requests leave the browser as relative URLs and the `Set-Cookie` that comes
back is first-party.

This is not a style preference. The session cookies are `SameSite=Lax`, and two
`*.vercel.app` deployments are *cross-site* — `vercel.app` is on the Public Suffix List — so
calling the API directly would need `SameSite=None`, which third-party cookie blocking
eventually breaks. The rewrite also removes CORS from the browser's path entirely and keeps
working on preview deployments, which get a fresh hostname every push.

### 1. Neon

Create a project, then take **two** connection strings from the dashboard:

| Variable | Neon host | Used by |
|---|---|---|
| `DATABASE_URL` | the one **with** `-pooler` | the running API — every serverless invocation is its own process, and unpooled connections exhaust the database long before traffic does |
| `DIRECT_DATABASE_URL` | the one **without** `-pooler` | `prisma migrate` only — a pooler cannot hold the advisory lock a migration takes |

Both need `?sslmode=require`. Prisma requires `DIRECT_DATABASE_URL` to exist wherever the
schema is read, including locally — there is no fallback to `DATABASE_URL`.

Apply the schema from your machine (Neon is reachable over the public internet):

```bash
DATABASE_URL='<pooled>' DIRECT_DATABASE_URL='<direct>' pnpm --filter @archai/api prisma:deploy
```

### 2. API project (`archai-api`)

- **Root Directory**: `apps/api`
- Build, install and function settings come from `apps/api/vercel.json` — do not re-enter them in the dashboard.
- `api/index.js` is a CommonJS shim that requires `dist/serverless.js`. It exists because
  Vercel compiles files under `api/` with esbuild, which strips types *without* emitting the
  `design:*` decorator metadata Nest's DI reads; `nest build` (tsc) emits the real thing.

Environment variables:

```
NODE_ENV=production
DATABASE_URL=<neon pooled>
DIRECT_DATABASE_URL=<neon direct>
JWT_ACCESS_SECRET=<64+ random chars>
JWT_REFRESH_SECRET=<different 64+ random chars>
COOKIE_SECURE=true          # required: the API refuses to boot in production without it
WEB_ORIGIN=https://<web deployment>
TRUST_PROXY_HOPS=1          # Vercel's proxy is one hop; without this the rate limiter keys every user to it
AI_PROVIDER=gemini
AI_FALLBACK_PROVIDER=groq
GEMINI_API_KEY=             # empty ⇒ AI endpoints answer an honest 503
GROQ_API_KEY=
```

### 3. Web project (`archai-web`)

- **Root Directory**: `apps/web`
- Framework preset: Next.js (default build is correct; `output: 'standalone'` stays off — it
  is opt-in via `NEXT_OUTPUT_STANDALONE` for the Docker image only)

```
NEXT_PUBLIC_API_URL=same-origin        # browser sends relative /api/v1/... URLs
API_ORIGIN=https://<api deployment>    # server-side rewrite target
```

`same-origin` and the empty string mean the same thing; the word is spelled out because an
empty value in a dashboard is easy to mistake for an unset one.

### Known limits

- **Rate limiting is per-instance.** `@nestjs/throttler` keeps counters in memory, and every
  serverless instance has its own — the configured limits are effectively multiplied by the
  number of warm instances. A shared store (Upstash Redis) is needed before the limits mean
  anything under real traffic.
- **Cold starts.** Bootstrapping Nest and connecting Prisma measured ~520 ms locally; expect
  more on a cold Lambda with the query engine to load. `serverless.ts` caches the bootstrap
  *promise*, so concurrent cold requests share one startup instead of racing to build several.
- **`argon2` is a native module.** It installs from prebuilt binaries on Vercel's build
  image; if a future version ships without a matching prebuild, password hashing breaks at
  runtime rather than at build time. `@node-rs/argon2` is the usual swap — it reads the same
  PHC hash format, so existing passwords keep verifying.
- **Seeding refuses to run in production** unless `ALLOW_PROD_SEED=true`. It plants
  repo-published demo passwords; only enable it deliberately, and change them immediately.

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
