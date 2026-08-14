# Roadmap

Status: DONE / IN_PROGRESS / TODO / BLOCKED

## Vertical slices

1. **Foundation** — DONE (pushed 68af04b)
   Monorepo, shared domain package, Prisma schema, Docker Postgres, docs, tooling.
   CI workflow written but **local-only**: pushing `.github/workflows/` needs the GitHub
   token to get the `workflow` scope → run `gh auth refresh -h github.com -s workflow`.
2. **Slice 1: Project core** — DONE (pushed 68af04b)
   Auth → dashboard → configurator → workspace. 12 unit + 28 e2e tests, browser-QA'd
   (desktop+mobile). 3 defects found in QA and fixed (relativeTime now, 422 details
   shape, stale-closure room adds).
3. **Slice 2: AI parsing** — DONE (code + tests); live-key evaluation PENDING
   packages/ai (provider abstraction, claude-opus-5 structured outputs, versioned
   injection-hardened prompt, 54 unit tests), POST /ai/parse-project (provenance rows,
   full error contract, 11 e2e tests), AI creation path on /projects/new (review panel,
   assumptions/unmappable, apply flow). Without `ANTHROPIC_API_KEY` the UI shows an honest
   "not configured" panel (verified live). When the key lands: run the manual uz/ru/en
   prompt evaluation checklist (docs/testing.md).
4. **Slice 3: 2D floor-plan engine** — DONE
   Deterministic geometry engine (37 tests + 12k-config fuzz), persisted plans with
   inputHash/engineVersion provenance, GET floor-plan endpoint (8 e2e tests), SVG viewer
   (pan/zoom/floors/legend/dimension lines) live in the workspace 2D tab. All three API
   outcomes (200/409/422) verified in the browser. Spec: docs/floor-plan-engine.md.
5. **Slice 4: 3D visualization** — DONE
   Pure scene-builder (plan→3D: split walls with openings, glass, stairs, gable roof,
   land plate) + R3F viewer (demand frameloop, orbit, floor cutaway, async-chunked —
   +3 kB route First Load). Live-verified: geometry AABBs match spec, unmount cleanup,
   uz/ru/en. Workspace tabs now live: Umumiy | 2D | 3D.
6. **Slice 5: Interior/exterior concepts** — TODO (image generation + asset storage)
7. **Slice 6: Estimate engine** — TODO (deterministic rules, admin-configurable)
8. **Slice 7: PDF export** — TODO
9. **Slice 8: Admin panel** — TODO (users/projects/templates/pricing/blog/FAQ/audit)
10. **Hardening** — TODO (security QA, performance QA, accessibility QA, CI green, Docker prod)

## Deferred decisions

- Worker/queue infra: not introduced yet — no long-running jobs until slice 3+.
  Re-evaluate when AI generation lands (DB-backed job status first, queue only if needed).
- Payments provider: undecided; pricing domain will be provider-independent.
- Object storage: undecided until slice 5 (local disk abstraction first, S3-compatible later).
