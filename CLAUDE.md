# archAi — Architecture Online AI

Web platform for creating, configuring, visualizing and exporting residential architecture
projects. Users describe or configure land + house + rooms + features; the platform produces
structured project data, deterministic 2D floor plans, 3D previews, AI-assisted parsing,
estimates and PDF exports. Primary market: Uzbekistan (uz default locale, ru/en supported).

## Repository layout

- `apps/web` — Next.js 15 (App Router, React 19, Tailwind v4, TanStack Query, next-intl)
- `apps/api` — NestJS 11 (REST `/api/v1/*`, Prisma 6, PostgreSQL, cookie JWT auth, Swagger)
- `packages/shared` — **source of truth** for zod schemas, domain validation, API types.
  Compiled to CJS (`dist/`); both apps import `@archai/shared`. Build it before typechecking apps.
- `docs/` — product requirements, architecture, API contract, roadmap, ADRs in `docs/decisions/`

## Commands (run from repo root)

- `pnpm install` — install everything
- `pnpm db:up` — start PostgreSQL (Docker; db `archai`, test db `archai_test`)
- `pnpm db:migrate` / `pnpm db:seed` — Prisma migrate dev / seed demo data
- `pnpm dev` — shared watch + api (:3001) + web (:3000)
- `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test`
- API env lives in `apps/api/.env` (copy from `.env.example`). Never commit `.env`.

## Conventions

- TypeScript strict everywhere; `any` is an eslint error.
- Validation: zod schemas in `packages/shared/src/schemas` (API uses ZodValidationPipe;
  web forms use the same schemas via @hookform/resolvers). Business rules live in
  `packages/shared/src/domain` — never only in forms or controllers.
- Zod schema custom messages are stable snake_case keys (e.g. `land_area_min`); the web
  localizes them. Domain issues use `DOMAIN_ISSUES` codes.
- Auth: httpOnly cookie JWTs (`archai_access`, `archai_refresh`), refresh rotation with
  hashed tokens in DB. All authorization is enforced server-side with ownership checks.
- API error contract: `ApiErrorShape { statusCode, code, message, details? }`.
- i18n: next-intl without locale routing; locale from `archai_locale` cookie, default `uz`.
  All user-facing strings go in `apps/web/messages/{uz,ru,en}.json` — never hardcoded.
- AI (slice 2+): provider-abstracted in a dedicated package; AI output always passes
  schema + domain validation before touching the database. Keys server-side only.

## Git policy (strict)

- Conventional commits (`feat(scope): …`). Milestone-level commits, not micro-commits.
- **Never add AI attribution: no `Co-Authored-By: Claude`, no "Generated with" trailers,
  no Anthropic/agent credits in commits, notes or changelogs. Owner requirement.**
- Author identity: the developer's existing git config (AzimovAsadbek). Do not change it.
- Push milestones to `origin main` (https://github.com/AzimovAsadbek/archAi.git) after
  lint + typecheck + tests + build pass. Never force-push without explicit approval.
- Before commit: check diff for secrets and junk files.

## Current state

Live product: auth → dashboard → configurator or AI description → workspace with
Umumiy | 2D | 3D | Smeta tabs + PDF export; /admin panel (users, projects, estimate
rules, audit). Postgres runs on host port **5433** (native PG owns 5432). AI needs
`ANTHROPIC_API_KEY` in apps/api/.env (UI degrades honestly without it). CI workflow
lives in `.github/workflows-pending/` until the GitHub token gains the `workflow`
scope. See `docs/roadmap.md` for slice status. Test accounts after seeding:
`demo@archai.uz` / `Demo1234!` and `admin@archai.uz` / `Admin1234!`.
