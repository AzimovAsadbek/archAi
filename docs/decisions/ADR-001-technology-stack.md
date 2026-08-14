# ADR-001: Technology stack

**Status:** accepted · 2026-08-14

## Decision

pnpm monorepo: Next.js 15 + React 19 + Tailwind v4 + TanStack Query + RHF + next-intl (web);
NestJS 11 + Prisma 6 + PostgreSQL 16 (Docker) + cookie JWT auth (api); shared CJS package for
zod v4 schemas + domain rules + API types. Vitest for tests (unplugin-swc for Nest decorators).
Node ≥20 (dev machine: 24).

## Rationale

- Team-of-one + AI agents → boring, well-documented, strongly-typed mainstream stack.
- Shared zod schemas give one source of truth for client + server validation (API/UI contract).
- Cookie-based JWT (httpOnly) avoids tokens in JS; SameSite=Lax + CORS origin allowlist
  is a sane CSRF baseline for a same-site localhost/prod setup.
- argon2id for password hashing (prebuilt binaries fine on Windows).
- Tailwind v4 token-first theming matches the design-system requirement without extra deps.

## Consequences

- `packages/shared` must build before app typechecks (workspace topological build handles it).
- Prisma schema is the DB source of truth; flat columns for project config (no JSONB yet —
  structure is stable and queryable; JSONB reserved for genuinely flexible data later).
