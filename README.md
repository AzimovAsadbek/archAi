# archAi · residential floor-plan design

Describe a house in Uzbek, Russian or English and review the proposed rooms, dimensions and layout
preferences. Once you approve the configuration, a layout engine generates the floor plan. The web
app also provides a 3D preview, cost estimates and PDF export.

## From a brief to a floor plan

1. The API sends the brief to a model. A provider router can switch from Gemini to Groq on
   transient failures. [Provider router](packages/ai/src/router.ts) · [Routing tests](packages/ai/src/__tests__/router.test.ts)
2. The model returns a proposal. A Zod schema checks its structure, and the application presents the
   result for review. [Proposal schema](packages/ai/src/schemas/proposal.schema.ts) · [AI architecture](docs/ai-architecture.md)
3. The layout engine uses the accepted configuration to place rooms. [Layout implementation](packages/floor-plan-engine/src/layout.ts) · [Layout tests](packages/floor-plan-engine/src/__tests__)

## Stack

Next.js 15 · React 19 · Tailwind v4 · NestJS 11 · Prisma 6 · PostgreSQL 16 · TypeScript strict ·
pnpm workspaces. Locales: uz (default), ru, en.

## Quick start

```bash
pnpm install --frozen-lockfile
cp .env.example apps/api/.env        # then set real JWT secrets
docker compose up -d postgres
pnpm --filter './packages/**' build
pnpm --filter @archai/api prisma:generate
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
| `packages/ai` | Model providers, prompts, structured output and routing |
| `packages/floor-plan-engine` | Room layout and geometry |
| `packages/shared` | zod schemas, domain validation, API types (source of truth) |
| `docs/` | requirements, architecture, API contract, ADRs, roadmap |

## Scripts (root)

`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm test` ·
`pnpm db:up` · `pnpm db:migrate` · `pnpm db:seed`

See `docs/roadmap.md` for delivery status.

After setup, this command runs the model routing, prompt and schema tests locally.

```bash
pnpm --filter @archai/ai test
```
