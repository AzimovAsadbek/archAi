# Architecture

## Shape: modular monolith, two deployables + shared packages

```
apps/web  (Next.js 15)  ──HTTP──▶  apps/api (NestJS 11) ──Prisma──▶ PostgreSQL 16
        ▲                                  ▲
        └────────── packages/shared ───────┘   (zod schemas, domain rules, API types)
```

- **packages/shared** is the contract layer: schemas, domain validation, DTO types.
  Compiled to CJS; consumed by both apps. Changes here are cross-cutting — review carefully.
- **apps/api** owns persistence and authorization. Modules: `auth`, `users`, `projects`,
  (`prisma` infrastructure module). Future: `ai`, `floor-plans`, `estimates`, `assets`,
  `admin`, `blog`, `pricing` — added per vertical slice.
- **apps/web** is a thin client: server-rendered public pages, client-side app pages
  (TanStack Query against the API). No secrets in the browser.
- **No worker/queue yet** (ADR-002): nothing long-running exists. AI/PDF generation will
  start as DB-status-tracked async operations; a queue is introduced only if real load demands it.

## Cross-cutting rules

- Every protected resource is owner-scoped in SQL (`where ownerId = user.id`), not in JS after fetch.
- Cross-user access returns 404 to avoid existence leaks. Admin bypass (later) must be explicit + audited.
- Soft delete for projects (`deletedAt`); hard delete only via future admin/cleanup with audit.
- Status lifecycle: `DRAFT → CONFIGURED → GENERATING → READY | FAILED`, `ARCHIVED` orthogonal
  via archive/unarchive. Transitions computed in the API service layer, never trusted from clients.
- Heavy future domains (floor-plan engine, AI, estimates) live in their own packages with
  deterministic cores — AI proposes, domain validates, application executes.

## Known performance notes (bounded, deferred)

Surfaced by the independent audit; each is bounded by a per-IP throttle today and none
affects correctness. Documented rather than silently carried:

- **`GET /projects/:id/floor-plan` mutates on a cache miss.** It regenerates and upserts the
  plan when the config `inputHash`/engine version changes (or deletes a stale row on engine
  failure). Steady state is a pure read; throttled 30/min/IP. A cleaner design moves
  regeneration to the write path (project create/update) or an explicit POST — deferred.
- **PDF export re-reads the project three times** (once directly, once each inside the
  reused floor-plan and estimate services) and renders pdfkit synchronously on the request
  tick. Bounded 10/min/IP. A single shared fetch + a worker-thread render are the fix if
  export volume grows.

## Future extraction lines (do not build now)

AI service / generation workers / media service — only when scaling or isolation demands it.
