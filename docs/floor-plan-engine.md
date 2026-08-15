# Floor-plan engine — specification (v1)

Package: `packages/floor-plan-engine` (`@archai/floor-plan-engine`). Pure TypeScript,
CJS build like `@archai/shared` (which it may import). No DOM, no framework, no I/O,
no randomness. **Deterministic: identical input ⇒ deep-equal output.** Export
`FLOOR_PLAN_ENGINE_VERSION = '1.0.0'` (bump on any algorithm change — persisted plans
cite it for provenance).

## Coordinate system & units

Meters, two decimals max (snap 0.01). Origin at the footprint's top-left corner;
x grows rightward (house width W), y grows downward (house length L). All shapes are
axis-aligned rects `{ x, y, width, height }` or segments `{ x1, y1, x2, y2 }`.

Constants: exterior wall 0.30 m, interior wall 0.15 m, corridor width 1.30 m,
door width 0.90 m (bathroom/storage 0.80), window length ≈ 40% of the room's exterior
wall run (clamped 0.8–2.4 m), stair core 2.8 × 1.5 m (multi-floor only), min room side
after layout 1.5 m.

## Types (exported, JSON-serializable)

```ts
FloorPlanInput = { house: { widthM, lengthM, floorCount }, rooms: RoomSpec[] }
RoomSpec       = { id?: string; type: RoomType; floor: number;
                   widthM?: number|null; lengthM?: number|null; label?: string|null }
FloorPlan      = { engineVersion: string; house: { widthM; lengthM; floorCount };
                   floors: FloorGeometry[] }
FloorGeometry  = { index: number; outline: Rect;            // inner usable area
                   rooms: PlacedRoom[]; walls: Wall[]; doors: Door[];
                   windows: Window[]; stairs: Stair | null; corridor: Rect | null }
PlacedRoom     = { key: string;         // stable: roomId if given else `f{floor}-{type}-{n}`
                   type: RoomType; label: string|null; rect: Rect; areaM2: number;
                   requestedAreaM2: number|null }
Wall           = { id: string; kind: 'exterior'|'interior'; thickness: number;
                   segment: Segment }
Door           = { id: string; wallId: string; roomKeys: [string, string|null];
                   // null second key = opens to corridor/outside
                   center: Point; width: number }
Window         = { id: string; wallId: string; roomKey: string; center: Point;
                   length: number }
Stair          = { rect: Rect; direction: 'up'|'down'|'both' }
```

`generateFloorPlan(input: FloorPlanInput): FloorPlanResult` where `FloorPlanResult =
{ ok: true, plan: FloorPlan } | { ok: false, issues: EngineIssue[] }` and `EngineIssue`
has a stable `code` (`FOOTPRINT_TOO_SMALL`, `ROOM_AREA_UNSATISFIABLE`, `TOO_MANY_ROOMS_PER_FLOOR`, …)
plus meta. Inputs are assumed schema-valid (ranges) but the engine re-checks feasibility.

## Layout algorithm (per floor)

1. **Usable area**: footprint minus exterior wall inset ⇒ `outline` rect
   (W−0.6 × L−0.6 at 0.3,0.3).
2. **Stair core** (floorCount > 1): fixed position — right edge of the usable area,
   top corner; identical rect on every floor. Floors > 0 with zero rooms still get
   stairs + empty layout.
3. **Corridor**: if the floor has ≥ 4 rooms (excluding stairs), a horizontal corridor
   band (height 1.30) across the usable width, positioned so the two resulting bands'
   target areas balance; rooms split into two bands. With < 4 rooms, no corridor —
   rooms form a single strip and connect directly.
4. **Area targets**: a room's target = widthM×lengthM when both dims exist, else a
   type default (LIVING_ROOM 22, BEDROOM 14, KITCHEN 12, DINING_ROOM 12, OFFICE 10,
   BATHROOM 5, LAUNDRY 4, STORAGE 4, HALLWAY 6, OTHER 10). Scale ALL targets by a
   single factor so their sum equals each band's available area (preserves declared
   proportions; declared dims are preferences, not guarantees — the UI communicates
   plans are schematic).
5. **Strip packing**: within a band, rooms are placed left→right in input order as
   full-height rects with width = target/bandHeight (snap 0.01, min side 1.5). The last
   room absorbs rounding drift so the band is filled exactly.
6. **Walls**: exterior ring (4 segments, thickness 0.3, centered on the footprint
   boundary) + interior partitions: shared edges between adjacent room rects and
   between rooms and corridor (thickness 0.15, deduplicated — one wall per shared edge).
7. **Doors**: every room gets exactly one door: on its corridor-facing edge (midpoint)
   when a corridor exists; else on the shared edge with the previous room in the strip
   (first room of a strip: door on the outline edge = exterior entry for floor 0, or
   stair-side edge on upper floors). Floor 0 always has one exterior entry door into
   the living room if present, else the first room.
8. **Windows**: rooms with an edge on the outline perimeter get one window centered on
   their longest exterior run (length rule above); BATHROOM/STORAGE/LAUNDRY/HALLWAY get
   none. No window may overlap a door span on the same wall.
9. **Failure**: if any room's final side < 1.5 m or a band cannot fit its rooms,
   return `ok: false` with issues — never emit overlapping/degenerate geometry.

## Invariants (each one is a test)

1. Determinism: two runs on the same input are deep-equal.
2. Every room rect ⊆ its floor outline; stairs/corridor too.
3. No two room rects on a floor overlap (area of pairwise intersections = 0);
   rooms don't overlap stairs or corridor.
4. Per floor: Σ(room areas) + corridor + stairs ≈ outline area (±0.5 m²) when layout
   succeeds with a corridor; without corridor Σ rooms + stairs ≈ outline area.
5. Every door/window center lies on its wall's segment; window spans stay within the
   wall run and never intersect a door span on the same wall.
6. Every room has ≥ 1 door; floor 0 has ≥ 1 exterior door; every floor of a
   multi-floor house has the same stair rect.
7. Room keys are unique and stable across runs.
8. Degenerate inputs (min footprint 4×4 with one room; 40 rooms; all rooms on one
   floor of a 3-floor house; rooms with huge declared dims) either succeed with valid
   geometry or fail with issues — never throw, never emit invalid geometry.

## Implementation notes (v1.0.0, resolved during build — normative)

- Exterior wall center lines are inset 0.15 (half thickness): the 0.30 band occupies
  [0, 0.30] inside the footprint; the outline is its inner face.
- With stairs, a floor uses **three** bands: a 1.5 m strip beside the stair core (takes
  the smallest rooms) + the two main bands. Rooms+corridor+stairs tile the outline
  exactly; the only allowed uncovered pocket is the stair-side strip on floors with
  0–1 rooms (an L-region can't be tiled by one rect).
- Multi-floor houses narrower than ≈4.9 m usable with ≥2 rooms on a floor fail with
  `FOOTPRINT_TOO_SMALL`; shallow floors fall back to a single band instead of failing.
- One door per room with dedup: a shared door serves both rooms via `roomKeys`.
  Priority: corridor → stairs → previous/next in band → any adjacent → exterior.
- Window spans are additionally capped to the largest door-free gap on the wall
  (skipped if the gap < 0.8 m); tie-break for equal exterior runs: S, N, W, E.
- Packing clamps sides at 1.51 m internally so 0.01 snapping never emits < 1.5 m.
- Extra issue codes: `ROOM_ON_MISSING_FLOOR`, `INVALID_INPUT`, `INTERNAL_ERROR`
  (top-level catch — the engine never throws). Duplicate room ids get `-2`/`-3` suffixes.
- Stair direction: floor 0 `up`, top `down`, middle `both`.
- Validated by 37 unit/invariant tests plus a committed, seeded **5,000-config fuzz**
  (`src/__tests__/fuzz.test.ts`; ~625 deep-validated against every invariant, the rest
  shape-checked): 0 throws, 0 invalid geometry, both accept/reject branches exercised, and
  determinism verified on a 250-config sample.

## Consumers (implemented with this slice)

- **API**: `floor_plans` table (id, projectId unique FK cascade, engineVersion,
  inputHash sha256 of canonical FloorPlanInput JSON, geometry JSONB, generatedAt).
  `GET /api/v1/projects/:id/floor-plan` → 200 `{ plan, generatedAt }` — always fresh
  (owner-scoped; recomputes+upserts when inputHash/engineVersion differ or row absent;
  409 `PROJECT_NOT_CONFIGURED` if `isConfigurationComplete` is false; 422
  `FLOOR_PLAN_UNAVAILABLE` with engine issues when the engine returns ok:false).
- **Web**: SVG `FloorPlanViewer` in the workspace 2D tab — floor switcher, pan (drag)
  + zoom (wheel + buttons, 0.5–4×), room fills by type + localized labels + m²,
  dimension labels for footprint, door arcs/window ticks, loading/error/not-configured
  states, responsive + touch drag, keyboard-accessible zoom controls.
  **Room selection (§23/§27):** every room is a keyboard-focusable button
  (Enter/Space toggles, Esc clears, background click clears; a 5 px slop
  separates clicks from pans). Selection draws an accent ring plus the room's
  own width/length dimension lines (shown only when both sides are ≥ 64 px on
  screen — progressive disclosure), and a details bar (name, type, floor,
  W×L, m²) announced via `aria-live`. Selection is ephemeral UI state (§44) —
  never persisted.
- **Web 3D**: `ThreePanel`/`HouseScene` build the scene from the *same* persisted
  plan (`scene-builder.ts`, pure + deterministic). Camera presets (§31):
  orbit / top / front / side / isometric, framed against the model's bounding
  sphere, plus reset; floor cutaway + roof toggle. Materials are style-aware
  (§34/§56): the project's `HouseStyle` selects a preset (wall/roof/floor/glass
  + roof roughness) in `scene-palette.ts` — presentation only, geometry is
  byte-identical across styles (unit-tested). A one-frame `ContactShadows`
  grounds the model without per-frame cost (compatible with
  `frameloop="demand"`); instanced meshes keep one draw call per material.
