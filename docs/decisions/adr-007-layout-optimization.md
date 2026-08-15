# ADR-007: Candidate-based layout optimization via seeded ordering search

**Status:** accepted (engine 1.1.0)

## Context

The engine laid rooms into bands in input order — one deterministic layout per
input, with no notion of layout *quality*. The intelligent-layout milestone
requires adjacency awareness, scoring and optimization without destabilizing the
rectangle-based geometry (its invariants are guarded by 46 tests + a 5,000-config
seeded fuzz).

## Decision

Optimize by **seeded permutation search over room orderings** (`layout/optimize.ts`):
generate up to N orderings (identity first, then seeded Fisher–Yates shuffles,
deduped), run each through the unchanged `generateFloorPlan`, score the valid
plans, return the best. Ties keep the earliest candidate, so results only ever
change when a permutation is strictly better.

Scoring (`layout/score.ts`) is normalized (0..1 per component, weights sum to 1,
total 0..100) and explainable (§18): room-area fit, shape quality (aspect-ratio
comfort), type-preference adjacency (`layout/adjacency.ts` — kitchen–dining,
bedroom–bathroom, bedroom–living separation, …), footprint efficiency (band
target, not 100% utilisation) and daylight potential (window-opportunity share —
a heuristic proxy, not solar simulation).

## Why this algorithm (§21)

- **Deterministic:** mulberry32 seed; the API pins `seed: 1`, so identical input
  + engine version still yields byte-identical geometry (caching by inputHash
  keeps working).
- **Explainable:** every candidate is a real engine run; the score names its
  components. No hidden mutation of geometry.
- **Safe:** hard constraints stay where they were — an ordering that fails
  generation simply isn't a candidate; scoring never compensates (§14). Rooms
  are reordered, never dropped (§7, tested).
- **Bounded:** ≤16 candidates ≈ tens of ms (each run ≈ 4 ms measured by fuzz);
  §23's budget holds without a worker.
- Rejected alternatives: simulated annealing / beam search over free rectangle
  placement — more expressive, but requires a placement representation the
  current band engine doesn't have; deferred until polygon/CAD milestones.

## Consequences

- Engine version bumped to 1.1.0 → persisted plans regenerate lazily.
- The score is computed but not yet persisted or shown; surfacing it (§72) and
  requirements/zones/strategies (§6/§11/§20) build on this layer next.
