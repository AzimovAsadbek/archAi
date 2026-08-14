# Testing

## Layers

- **Unit (packages/shared)** — vitest. Domain rules (`validate-project`), future: floor-plan
  geometry invariants, estimate calculations, AI output evaluators. Run: `pnpm --filter @archai/shared test`.
- **API e2e (apps/api/test)** — vitest + supertest against a real Nest app and the
  `archai_test` database (never the dev DB; `test/setup.ts` forces `TEST_DATABASE_URL` and
  runs `prisma migrate deploy`). Covers auth lifecycle, project CRUD, ownership denial (404),
  validation failures (400/422), archive/duplicate flows. Requires Postgres: `pnpm db:up`.
- **Web** — typecheck + production build are the slice-1 gate; browser E2E (Playwright) is
  planned once flows stabilize (roadmap: hardening phase). Visual QA is performed with the
  in-session browser on every milestone (desktop/tablet/mobile + console/network checks).

## Rules

- A feature without tests for its failure modes is not done (see Definition of Done).
- Tests assert error *contracts* (status + `code`), not message strings (strings are localized).
- AI slice: adapter tests use recorded/stub responses; schema-validation tests feed malformed
  outputs; no live-API calls in CI.
- CI (`.github/workflows/ci.yml`): install → shared build → prisma generate → lint →
  typecheck → tests (unit + e2e with service Postgres) → builds. Must be green before a
  milestone is called complete.
