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
3. **Slice 2: AI parsing** — DONE; runtime AI now free-tier-first (see Runtime-AI note under Hardening)
   packages/ai (provider abstraction, versioned injection-hardened prompt, 69 unit tests),
   POST /ai/parse-project (provenance rows, full error contract, 13 e2e tests incl. `/ai/status`
   + per-user quota), AI creation path on /projects/new (review panel, assumptions/unmappable,
   apply flow). Without a provider key the UI shows an honest "not configured" panel.
4. **Slice 3: 2D floor-plan engine** — DONE
   Deterministic geometry engine (37 unit/invariant tests + a committed 5,000-config seeded
   fuzz), persisted plans with inputHash/engineVersion provenance, GET floor-plan endpoint
   (8 e2e tests), SVG viewer (pan/zoom/floors/legend/dimension lines) live in the workspace
   2D tab. All three API outcomes (200/409/422) verified in the browser. Spec:
   docs/floor-plan-engine.md.
5. **Slice 4: 3D visualization** — DONE
   Pure scene-builder (plan→3D: split walls with openings, glass, stairs, gable roof,
   land plate) + R3F viewer (demand frameloop, orbit, floor cutaway, async-chunked —
   +3 kB route First Load). scene-builder is unit-tested (AABBs/determinism); the R3F
   layer is verified by browser QA. Workspace tabs now live: Umumiy | 2D | 3D.
6. **Slice 5: Interior/exterior concepts** — BLOCKED (needs a genuinely free image-generation
   provider; the runtime text model is text-only — §28 of the migration brief). Image
   generation + asset storage; workspace tabs reserved and honestly disabled.
7. **Slice 6: Estimate engine** — DONE
   Pure calculateEstimate in shared (13 unit tests, exact-sum contract), estimate_rules
   JSONB versioning with single-active index, GET /projects/:id/estimate, Smeta tab
   (finish levels, breakdown, UZS formatting, disclaimer). Pushed 54e2d92.
8. **Slice 7: PDF export** — DONE
   Deterministic pdfkit report (cover/summary/native floor plans/estimate, uz/ru/en,
   Manrope embedded, byte-identical repeats), workspace PDF action. Pushed 179c6a3.
9. **Slice 8: Admin panel** — DONE (v1: users, projects, estimate rules, audit)
   Audited server-side RBAC, session-revoking deactivation, rules activation without
   deploy, /admin UI with 4 sections. Pushed 04593c3. Templates/assets/blog/FAQ/pricing
   plans → public-content slice (TODO below).
10. **Public content & pricing** — DONE (pushed a6c3a61 backend, c5eaace web)
    Pricing (honest beta-free, no checkout), blog (safe markdown, XSS-verified, SEO/JSON-LD),
    FAQ (accessible disclosures), help/about, sitemap/robots; FAQ/blog/pricing DB domains
    with admin CRUD + audit. Admin now covers users/projects/estimate-rules/blog/faq/pricing/audit.
11. **Hardening** — IN_PROGRESS
    - Security: independent review done, all High/Med findings fixed + verified live
      (pushed 8dc9a3b). Documented in docs/security.md.
    - Docker production images: DONE — api + web multi-stage Dockerfiles +
      docker-compose.prod.yml, both smoke-tested (boot + serve). docs/deployment.md.
    - Accessibility & UX: independent a11y/UX audit done; fixes verified live — AA contrast
      (ink-faint, accent→accent-strong buttons/links, success), skip links on every shell,
      roving-tabindex tablist, dialog focus-return, prefers-reduced-motion, color-scheme,
      mobile hamburger nav + locale switcher, aria-required, distinct roadmap-tab names.
      Deferred (documented): `uz` long-form dates fall back to numeric because Chrome/Node
      ship no `uz` CLDR month/relative-time data — relative time itself is fixed via a
      catalog helper (see relative-time.ts); configurator step-level autosave; /admin index polish.
    - Web unit tests: DONE — vitest suite (33 tests): safe-next-path open-redirect vectors,
      relative-time bucketing + uz/ru/en catalog rendering, format helpers, i18n parity +
      referenced-key guard, scene-builder AABB/determinism invariants.
    - Performance: hot-path indexes added; two bounded notes documented in docs/architecture.md
      (mutating floor-plan GET, PDF triple-fetch). CI activation still needs the gh token
      `workflow` scope (workflow lives in .github/workflows-pending/).
    - Runtime AI: migrated off Anthropic to a free-tier-first, provider-agnostic stack —
      Gemini `gemini-flash-latest` primary + Groq `openai/gpt-oss-120b` fallback + Mock, with a
      router (retry/fallback), per-user daily quota, usage tracking and honest degradation.
      Live-verified: a real Gemini request succeeded, fallback + prompt-injection resistance
      checked. The brief's `gemini-2.5-flash` / `llama-3.3-70b-versatile` were both retired by
      the live check, so the models were switched to current verified ones. docs/ai-architecture.md.
12. **AI project assistant** — DONE
    Two more AI operations on the free-tier stack: advisory design suggestions
    (`POST /ai/projects/:id/suggest`) and grounded Q&A (`POST /ai/projects/:id/ask`)
    for an existing project, surfaced in the workspace "Assistant" tab. Built on a
    base `ChatArchitectureAIProvider`, so a new operation is one method, not one per
    provider; the same validate→correct pipeline, per-user daily quota, provenance
    and honest degradation apply. Advisory only — the user reviews and applies by
    hand (§25, no auto-mutation); prompts are injection-hardened and scope-limited.
    `packages/ai` 88 unit tests; api e2e covers both endpoints (success, ownership
    404, validation, provider failure). Live-verified on Gemini: `suggest` returned
    valid, on-point output (flagged the missing kitchen/bathroom on a stub project);
    the free-tier daily quota then capped the remaining probes — confirming the
    rate-limit path. `ask` runs the identical proven pipeline (and parse's injection
    fencing was live-verified in the migration).
13. **2D/3D professional upgrade (increment 1)** — DONE
    From the same canonical plan: 2D room selection (keyboard-accessible, ring +
    per-room dimension lines + details bar, click-vs-pan slop, progressive
    disclosure below 64 px) and 3D camera presets (orbit/top/front/side/isometric),
    style-aware materials (all 6 HouseStyles, geometry untouched, unit-tested) and
    a one-frame contact shadow (demand-frameloop-safe). Verified live in-browser:
    selection/Esc/Enter, room dims "10.4 m"/"5.05 m", preset cycling, zero console
    errors. Deferred to later increments (explicitly, §94): furniture, roof-type
    variants (needs a domain `roofType` + migration + configurator), adjacency/
    scoring layout engine, CAD-style editing, architecture templates, polygon
    rooms. The engine's rect-based model, wall/door/window/stair semantics and
    5,000-config fuzz remain the validated foundation.

14. **Intelligent layout engine (increment 1: candidates + scoring)** — DONE
    Seeded candidate search over room orderings through the unchanged, fuzz-
    hardened generator; normalized explainable scoring (area fit, shape quality,
    type-preference adjacency, footprint efficiency, daylight potential); best
    valid plan wins, ties keep identity, rooms never dropped, hard failures stay
    structured issues. API generates via `generateBestFloorPlan` (seed pinned →
    still deterministic per input); engine 1.1.0 regenerates stored plans lazily;
    2D/3D/PDF/estimate inherit automatically. ADR-007. Deferred to next
    increments: requirements model (min/target/max areas, priorities), zones,
    circulation graph scoring, strategies, score UI (§72), AI layout hints.

15. **Intelligent layout engine (increment 2: requirements + strategies)** — DONE
    Requirements layer distinct from geometry (ADR-008): `ROOM_PROFILES` registry
    (zone, floor affinity, min/target/max bounds around the one canonical area
    table), `deriveRoomRequirements` with explicit-dims-beat-defaults precedence,
    pre-optimization feasibility gate (structured `INFEASIBLE_REQUIREMENTS` +
    adjustment suggestions), and five layout strategies (BALANCED/COMPACT/OPEN/
    PRIVACY/FAMILY) as normalized weight policies over a 7-component score
    (+floorPreference, +zoneGrouping). Strategies cannot legitimize invalid
    geometry; resolution explicit > suggested > BALANCED; engine 1.2.0.
    Deferred next: strategy selection UI + score surfacing (§46), AI intent
    mapping (ArchitectureIntent → requirements), circulation-graph scoring,
    priority-driven optional rooms.

16. **Intelligent layout engine (increment 3: AI intent → strategy)** — DONE
    The runtime AI now extracts layout intent: parse-project prompt v2 maps
    bounded qualitative phrases ("oilaviy uy" → FAMILY, "ochiq reja" → OPEN,
    "compact" → COMPACT, privacy wording → PRIVACY) into a schema-constrained
    `layoutStrategy` (null when nothing is implied — never guessed, never used
    to invent sizes). The union lives in `@archai/shared`; the sanitizer
    re-validates it; applying a proposal persists it on the project
    (`layout_strategy` column + migration); floor-plan generation resolves
    explicit > BALANCED and the strategy is part of the plan cache key, so a
    strategy change regenerates deterministically (e2e-proven round trip:
    PATCH → DTO reports strategy → hash changes → invalid 400 → null resets).
    The AI review panel shows the interpreted strategy card (uz/ru/en).
    Live-verified on real Gemini: "6 sotix yerga 2 qavatli oilaviy uy…" →
    layoutStrategy FAMILY (prompt v2, schema-valid); the COMPACT and
    no-preference cases hit the exhausted free-tier daily quota
    (AI_RATE_LIMITED surfaced cleanly) and remain schema/pipeline-tested only —
    re-verify live on a fresh quota day.
17. **Intelligent layout engine (increment 4: manual strategy selector)** — DONE
    A compact selector beside the layout-quality score in the 2D tab (where its
    effect is visible), all five strategies localized from the shared
    `strategies` namespace. Choosing one PATCHes `layoutStrategy`; prefix query
    invalidation refetches project + plan; the strategy-keyed cache regenerates
    the geometry and rescores under the new policy. Verified live in-browser:
    BALANCED 55/100 → PRIVACY 61/100, PATCH→GET→refetch trace clean, superseded
    request correctly aborted, zero console errors. An explicit selection here
    outranks the AI's suggestion by construction (`resolveStrategy`).
    Deferred next: circulation-graph scoring; re-run quota-blocked live probes.

## Deferred decisions

- Worker/queue infra: not introduced yet — no long-running jobs until slice 3+.
  Re-evaluate when AI generation lands (DB-backed job status first, queue only if needed).
- Payments provider: undecided; pricing domain will be provider-independent.
- Object storage: undecided until slice 5 (local disk abstraction first, S3-compatible later).
