# Roadmap

Status: DONE / IN_PROGRESS / TODO / BLOCKED

## Vertical slices

1. **Foundation** — IN_PROGRESS
   Monorepo, shared domain package, Prisma schema, Docker Postgres, docs, tooling, CI skeleton.
2. **Slice 1: Project core** — TODO
   Auth (register/login/refresh/logout) → dashboard → create project → configurator
   (land/house/rooms/features/style) → save → workspace rendering structured config.
3. **Slice 2: AI parsing** — TODO
   Natural language (uz/ru/en) → Anthropic provider → structured proposal → validation →
   user review → apply. Requires `ANTHROPIC_API_KEY`.
4. **Slice 3: 2D floor-plan engine** — TODO
   Deterministic geometry (rooms/walls/doors/windows/stairs) + SVG viewer (pan/zoom/floors).
5. **Slice 4: 3D visualization** — TODO (React Three Fiber)
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
