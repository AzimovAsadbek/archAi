# archAi — Architecture Online AI

A modern web platform for creating, configuring, visualizing and exporting residential
architecture projects: structured configuration, AI-assisted project understanding,
deterministic 2D floor plans, 3D previews, estimates and PDF export.

## Stack

Next.js 15 · React 19 · Tailwind v4 · NestJS 11 · Prisma 6 · PostgreSQL 16 · TypeScript strict ·
pnpm workspaces. Locales: uz (default), ru, en.

## Quick start

```bash
pnpm install
cp .env.example apps/api/.env        # then set real JWT secrets
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev                             # web http://localhost:3000 · api http://localhost:3001
```

Seeded accounts: `demo@archai.uz` / `Demo1234!` · `admin@archai.uz` / `Admin1234!`.
API reference: Swagger at http://localhost:3001/docs.

## Repository

| Path | What |
|---|---|
| `apps/web` | Next.js app (public site + product) |
| `apps/api` | NestJS REST API (`/api/v1`) |
| `packages/shared` | zod schemas, domain validation, API types (source of truth) |
| `docs/` | requirements, architecture, API contract, ADRs, roadmap |

## Scripts (root)

`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm test` ·
`pnpm db:up` · `pnpm db:migrate` · `pnpm db:seed`

See `docs/roadmap.md` for delivery status.
