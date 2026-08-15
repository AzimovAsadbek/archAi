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
- AI slice: `packages/ai` unit tests use fake SDK clients (69 tests: schema fixtures,
  wire-schema drift guard, parsing, Gemini/Groq provider mapping, router fallback, factory);
  API e2e binds a fake provider via the `ARCHITECTURE_AI_PROVIDER` DI token (unconfigured
  503, success + provenance, every error mapping, `/ai/status`, per-user quota → 429). **No
  suite makes a live provider call** (provider keys neutralised at module scope). Live
  provider verification (real Gemini/Groq keys) is manual and opt-in, never in CI:
  mixed-language, vague, contradictory, injection-attempt prompts + fallback, per
  docs/ai-architecture.md.
- CI (`.github/workflows/ci.yml`): install → shared build → prisma generate → lint →
  typecheck → tests (unit + e2e with service Postgres) → builds. Must be green before a
  milestone is called complete.
