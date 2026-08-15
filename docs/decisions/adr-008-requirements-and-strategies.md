# ADR-008: Requirements layer, room profiles, feasibility and layout strategies

**Status:** accepted (engine 1.2.0)

## Context

ADR-007 gave the engine candidate search + explainable scoring, but the engine
still consumed a bare room list: no notion of what a room *needs* (area bounds,
zone, floor affinity), no pre-flight feasibility, and one fixed scoring policy.

## Decisions

**`ArchitectureRequirements` is separate from `FloorPlan`.** Requirements
describe intent the engine can validate (min/target/max areas, priority, zone,
floor affinity); `FloorPlan` is geometry the engine produced. Manual
configuration and AI intent both normalize into the same requirements shape, so
the engine never has to know who asked (§5/§10). AI will only ever produce
intent → requirements — never authoritative geometry (§42).

**One profile registry.** `ROOM_PROFILES` derives per-type zone, floor affinity
and area bounds as stable ratios of the pre-existing `DEFAULT_ROOM_AREAS` table
— one source of truth, no scattered defaults (§16). Precedence: explicit user
dimensions > profile defaults (§17); explicit dims widen min/max to admit them.

**Feasibility before optimization (§25).** A cheap per-floor area-budget check
(minimum areas + stair core + 14% circulation allowance vs usable area) fails
impossible requests in microseconds with a structured
`INFEASIBLE_REQUIREMENTS` issue and machine-readable suggestions
(`increase_footprint` / `add_floor` / `reduce_rooms` / `reduce_room_areas`)
instead of burning the candidate budget to discover the same thing (§63).

**Strategies are scoring policies, not generators (§27).** BALANCED / COMPACT /
OPEN / PRIVACY / FAMILY each re-weight the shared 7-component score (adds
`floorPreference` and `zoneGrouping` to ADR-007's five); weights sum to 1
(tested), generation and hard validation are identical for all strategies, so a
strategy can never legitimize an invalid layout (§32). Resolution: explicit
user choice > AI suggestion > BALANCED (§30).

## Consequences

- Engine 1.2.0 (scoring policy affects which candidate wins → algorithm change).
- API generates with `strategy: 'BALANCED'` explicitly; per-input determinism
  and inputHash caching unchanged.
- Next increments build on this: strategy selection in the UI, score surfacing
  (§46), AI intent mapping (`ArchitectureIntent` → normalization →
  requirements), circulation-graph scoring, and priority-driven optional rooms.
