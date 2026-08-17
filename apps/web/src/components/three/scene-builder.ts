import {
  layoutSite,
  type Door,
  type FloorGeometry,
  type FloorPlan,
  type FloorPlanWindow,
  type SiteElementKind,
  type SiteFeatures,
  type Wall,
} from '@archai/floor-plan-engine';

/**
 * Turns a persisted floor plan into the box/triangle soup the 3D preview draws.
 *
 * Pure and deterministic: no three.js, no DOM, no randomness — identical input
 * produces a deep-equal, JSON-serializable `SceneModel`. The R3F layer only
 * uploads what this module computes, which keeps the geometry decisions
 * reviewable and lets the 2D and 3D tabs stay derived from the *same* plan.
 *
 * Coordinate mapping (docs/floor-plan-engine.md): plan space is metres with the
 * origin at the footprint's top-left corner, x rightward, y downward. The scene
 * maps `x → x`, `y → z`, `+y up`, and shifts everything by (−W/2, −L/2) so the
 * house is centred on the origin and orbiting pivots around its middle.
 *
 * Wall segments are centre lines carrying a thickness, and doors/windows are
 * spans of `centre ± size/2` along the wall axis — both are expanded to solids
 * here.
 */

// ── Construction constants (metres) ───────────────────────────────────────

/** Clear storey height, wall base to wall top. */
export const WALL_HEIGHT_M = 2.9;
/** Structural slab under every floor. */
export const SLAB_THICKNESS_M = 0.2;
/** Slab + walls: the vertical pitch between two consecutive floors. */
export const FLOOR_HEIGHT_M = WALL_HEIGHT_M + SLAB_THICKNESS_M;
export const DOOR_HEIGHT_M = 2.1;
export const WINDOW_SILL_M = 0.9;
export const WINDOW_HEIGHT_M = 1.3;
/** Roof slope, measured from the eave plane. */
export const ROOF_PITCH_RAD = (30 * Math.PI) / 180;
export const ROOF_OVERHANG_M = 0.3;
/**
 * A true 30° pitch turns into a tower on a wide footprint (a 16 m span would
 * ridge 4.7 m above the eaves), so the rise is capped — the roof reads as a
 * shallower gable instead of dwarfing the house.
 */
export const ROOF_MAX_RISE_M = 3.6;
/** Wood finish laid over the slab, inside the exterior walls. */
export const FLOOR_FINISH_M = 0.02;
/** Glazing pane thickness — thin enough to read as glass in a wall reveal. */
export const GLASS_THICKNESS_M = 0.04;
/**
 * Deep enough to contain a sunken pool.
 *
 * At 0.3 m the pool punched straight through the plate and out the underside,
 * so its walls intersected the ground instead of being held by it — which is
 * half of the shimmer when the camera moves.
 */
export const GROUND_THICKNESS_M = 1.8;
/**
 * Flush paving sits *on* the ground, not in it.
 *
 * A drive modelled from y=0 upward shares its bottom face with the lawn's top
 * face, and two coplanar surfaces have no correct draw order: the GPU picks per
 * pixel per frame, which is exactly the flicker you see while orbiting.
 */
export const PAVING_LIFT_M = 0.012;
/** Sunken elements stop short of grade so their top face never lands on it. */
export const SUNK_DROP_M = 0.04;
/** Fallback land plate margin when the project has no land dimensions. */
export const GROUND_MARGIN_M = 6;
/** Minimum breathing room between the footprint and the plate edge. */
export const GROUND_MIN_MARGIN_M = 2;
/**
 * Thickness given to flush paving — drives, paths.
 *
 * They have no real height, but a zero-height box and the ground plate would
 * occupy exactly the same pixels and flicker against each other as the camera
 * moves. A few centimetres reads as a kerb and settles the depth test.
 */
export const PAVING_THICKNESS_M = 0.06;
/** Steps per flight — a fixed count keeps the model deterministic. */
export const STAIR_STEP_COUNT = 13;

/** Sub-millimetre tolerance for geometric comparisons. */
const EPS = 1e-6;
/** Shorter than this a wall/opening piece is not worth a draw. */
const MIN_PIECE_M = 0.01;

// ── Model ─────────────────────────────────────────────────────────────────

export type Vec3 = [number, number, number];

/** Axis-aligned box: world-space centre plus full size along x/y/z. */
export interface SceneBox {
  center: Vec3;
  size: Vec3;
}

export interface SceneFloor {
  index: number;
  /** Bottom of the floor's slab. */
  baseY: number;
  /** Walking surface — the slab's top face and the wall base. */
  levelY: number;
  /** Top of the walls on this floor. */
  topY: number;
  /** Structural slab spanning the full footprint (exterior walls included). */
  slab: SceneBox;
  /** Wood finish inside the exterior walls. */
  finish: SceneBox;
  /** Opaque wall solids: piers, lintels and window spandrels. */
  walls: SceneBox[];
  /** Translucent panes filling the window apertures. */
  glass: SceneBox[];
  /** Stepped boxes of the flight rising to the floor above (empty when none). */
  steps: SceneBox[];
}

export interface SceneRoof {
  /** Non-indexed triangle soup: 3 floats per vertex, 9 per triangle. */
  positions: number[];
  /** Outward-facing flat normals, one per vertex, matching `positions`. */
  normals: number[];
  /** Eave (wall top) height and ridge height. */
  eaveY: number;
  ridgeY: number;
}

export interface SceneBounds {
  center: Vec3;
  radius: number;
}

/** A site element positioned in world space, ready to draw. */
export interface SceneSiteElement {
  kind: SiteElementKind;
  box: SceneBox;
}

export interface SceneSite {
  /** The whole property. Its top face is y = 0, like the ground plate. */
  plot: SceneBox;
  /**
   * The ground actually drawn: the plot split around anything sunk into it, so
   * a pool is a hole rather than a box overlapping an unbroken plate.
   */
  lawn: SceneBox[];
  /** Garage, drive, path, terrace, pool, balcony — whatever was configured and fits. */
  elements: SceneSiteElement[];
  /** Open ground reads as lawn rather than bare grade. */
  hasGarden: boolean;
}

export interface SceneModel {
  /** Provenance of the plan this model was derived from. */
  engineVersion: string;
  house: { widthM: number; lengthM: number; floorCount: number };
  floors: SceneFloor[];
  roof: SceneRoof | null;
  /** Land plate the house stands on; its top face is y = 0. */
  ground: SceneBox;
  /** The property around the building. */
  site: SceneSite;
  /** Bounding sphere of the building (plate excluded) — used to frame the camera. */
  bounds: SceneBounds;
  /** Bounding sphere of the whole property, for framing the site rather than the house. */
  siteBounds: SceneBounds;
  /** Grade to ridge (or to the top wall when there is no roof). */
  heightM: number;
}

export interface LandFootprint {
  areaM2?: number | null;
  widthM?: number | null;
  lengthM?: number | null;
}

export interface BuildSceneOptions {
  /** Plot dimensions when the project declares them; the plate falls back to a margin. */
  land?: LandFootprint | null;
  /** What the project asked for — garage, terrace, balcony, pool, garden. */
  features?: SiteFeatures | null;
}

// ── Numeric hygiene ───────────────────────────────────────────────────────

/** Emitted values are snapped to 0.1 mm so the output stays byte-stable. */
function r(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function box(
  centerX: number,
  centerY: number,
  centerZ: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
): SceneBox {
  return {
    center: [r(centerX), r(centerY), r(centerZ)],
    size: [r(sizeX), r(sizeY), r(sizeZ)],
  };
}

// ── Walls ─────────────────────────────────────────────────────────────────

/** Which world axis a wall runs along; its thickness spans the other one. */
type RunAxis = 'x' | 'z';

interface WallSolid {
  wall: Wall;
  axis: RunAxis;
  /** Run extent along `axis`, in plan coordinates. */
  from: number;
  to: number;
  /** Centre-line position across the thickness. */
  cross: number;
  thickness: number;
}

/**
 * Expands wall centre lines into runs.
 *
 * Ends are extended by half a thickness — the 2D renderer draws the same walls
 * with square line caps, and without the extension every corner of the exterior
 * ring would show a notch. The extension makes perpendicular walls overlap, so
 * z-running walls then yield to the x-running ones: their ends are pulled back
 * to the far face of any wall they are buried in. Coplanar duplicate faces
 * (which would z-fight while orbiting) disappear and the junctions butt exactly.
 */
function wallSolids(walls: readonly Wall[]): WallSolid[] {
  const solids: WallSolid[] = [];

  for (const wall of walls) {
    const { x1, y1, x2, y2 } = wall.segment;
    const half = wall.thickness / 2;

    if (Math.abs(y1 - y2) <= EPS && Math.abs(x1 - x2) > EPS) {
      solids.push({
        wall,
        axis: 'x',
        from: Math.min(x1, x2) - half,
        to: Math.max(x1, x2) + half,
        cross: y1,
        thickness: wall.thickness,
      });
    } else if (Math.abs(x1 - x2) <= EPS && Math.abs(y1 - y2) > EPS) {
      solids.push({
        wall,
        axis: 'z',
        from: Math.min(y1, y2) - half,
        to: Math.max(y1, y2) + half,
        cross: x1,
        thickness: wall.thickness,
      });
    }
    // Degenerate segments (a point) carry no geometry and are dropped.
  }

  const alongX = solids.filter((solid) => solid.axis === 'x');

  for (const solid of solids) {
    if (solid.axis !== 'z') continue;
    for (const other of alongX) {
      // Only walls this one actually runs into can trim it.
      if (solid.cross < other.from - EPS || solid.cross > other.to + EPS) continue;
      const lo = other.cross - other.thickness / 2;
      const hi = other.cross + other.thickness / 2;
      if (solid.from >= lo - EPS && solid.from < hi - EPS) solid.from = hi;
      if (solid.to > lo + EPS && solid.to <= hi + EPS) solid.to = lo;
    }
  }

  return solids.filter((solid) => solid.to - solid.from > MIN_PIECE_M);
}

type OpeningKind = 'door' | 'window';

interface Opening {
  kind: OpeningKind;
  start: number;
  end: number;
}

/** Door/window spans on one wall, ordered along the run and clipped to it. */
function openingsOn(solid: WallSolid, doors: readonly Door[], windows: readonly FloorPlanWindow[]) {
  const openings: Opening[] = [];

  for (const door of doors) {
    if (door.wallId !== solid.wall.id) continue;
    const center = solid.axis === 'x' ? door.center.x : door.center.y;
    openings.push({ kind: 'door', start: center - door.width / 2, end: center + door.width / 2 });
  }

  for (const opening of windows) {
    if (opening.wallId !== solid.wall.id) continue;
    const center = solid.axis === 'x' ? opening.center.x : opening.center.y;
    openings.push({
      kind: 'window',
      start: center - opening.length / 2,
      end: center + opening.length / 2,
    });
  }

  // Doors first on an exact tie so ordering never depends on array order.
  openings.sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
  return openings;
}

interface WallEmitTarget {
  walls: SceneBox[];
  glass: SceneBox[];
}

/**
 * Splits one wall run lengthwise around its openings: full-height piers between
 * them, a lintel over each door, and a spandrel + lintel plus a glass pane at
 * each window.
 */
function emitWall(
  solid: WallSolid,
  levelY: number,
  offsetX: number,
  offsetZ: number,
  doors: readonly Door[],
  windows: readonly FloorPlanWindow[],
  out: WallEmitTarget,
): void {
  const topY = levelY + WALL_HEIGHT_M;

  const push = (from: number, to: number, y0: number, y1: number, thickness: number): SceneBox => {
    const mid = (from + to) / 2;
    const height = y1 - y0;
    return solid.axis === 'x'
      ? box(mid + offsetX, (y0 + y1) / 2, solid.cross + offsetZ, to - from, height, thickness)
      : box(solid.cross + offsetX, (y0 + y1) / 2, mid + offsetZ, thickness, height, to - from);
  };

  const solidPiece = (from: number, to: number, y0: number, y1: number) => {
    if (to - from <= MIN_PIECE_M || y1 - y0 <= MIN_PIECE_M) return;
    out.walls.push(push(from, to, y0, y1, solid.thickness));
  };

  let cursor = solid.from;

  for (const opening of openingsOn(solid, doors, windows)) {
    const start = Math.max(opening.start, cursor);
    const end = Math.min(opening.end, solid.to);
    if (end - start <= MIN_PIECE_M) continue;

    solidPiece(cursor, start, levelY, topY);

    if (opening.kind === 'door') {
      solidPiece(start, end, levelY + DOOR_HEIGHT_M, topY);
    } else {
      const sill = levelY + WINDOW_SILL_M;
      const head = sill + WINDOW_HEIGHT_M;
      solidPiece(start, end, levelY, sill);
      solidPiece(start, end, head, topY);
      out.glass.push(push(start, end, sill, head, GLASS_THICKNESS_M));
    }

    cursor = end;
  }

  solidPiece(cursor, solid.to, levelY, topY);
}

// ── Stairs ────────────────────────────────────────────────────────────────

/** A flight of solid steps climbing one storey over the stair core's footprint. */
function buildSteps(
  floor: FloorGeometry,
  levelY: number,
  offsetX: number,
  offsetZ: number,
): SceneBox[] {
  const stairs = floor.stairs;
  // 'down' means the flight belongs to the floor below — it is drawn there.
  if (!stairs || stairs.direction === 'down') return [];

  const { rect } = stairs;
  // The run follows the longer side of the 2.8 × 1.5 core.
  const runAlongX = rect.width >= rect.height;
  const runLength = runAlongX ? rect.width : rect.height;
  const runStart = runAlongX ? rect.x : rect.y;
  const crossSize = runAlongX ? rect.height : rect.width;
  const crossCenter = (runAlongX ? rect.y + rect.height / 2 : rect.x + rect.width / 2);

  const tread = runLength / STAIR_STEP_COUNT;
  const rise = FLOOR_HEIGHT_M / STAIR_STEP_COUNT;
  const steps: SceneBox[] = [];

  for (let index = 0; index < STAIR_STEP_COUNT; index++) {
    const from = runStart + index * tread;
    const height = rise * (index + 1);
    const centerRun = from + tread / 2;
    const centerY = levelY + height / 2;

    steps.push(
      runAlongX
        ? box(centerRun + offsetX, centerY, crossCenter + offsetZ, tread, height, crossSize)
        : box(crossCenter + offsetX, centerY, centerRun + offsetZ, crossSize, height, tread),
    );
  }

  return steps;
}

// ── Roof ──────────────────────────────────────────────────────────────────

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Gable prism over the top floor, ridge along the longer footprint axis.
 *
 * Two sloped quads plus two gable-end triangles, all pushed out by the eave
 * overhang. Winding is forced outward against a reference direction, so the
 * same code produces correct normals for both ridge orientations.
 */
function buildRoof(widthM: number, lengthM: number, eaveY: number): SceneRoof {
  const ridgeAlongX = widthM >= lengthM;
  /** Half-extent along the ridge, then across it. */
  const halfRun = (ridgeAlongX ? widthM : lengthM) / 2 + ROOF_OVERHANG_M;
  const halfSpan = (ridgeAlongX ? lengthM : widthM) / 2 + ROOF_OVERHANG_M;
  const rise = Math.min(halfSpan * Math.tan(ROOF_PITCH_RAD), ROOF_MAX_RISE_M);
  const ridgeY = eaveY + rise;

  /** Local (run, height, span) → world, so one build serves both orientations. */
  const w = (run: number, y: number, span: number): Vec3 =>
    ridgeAlongX ? [run, y, span] : [span, y, run];

  const positions: number[] = [];
  const normals: number[] = [];

  const triangle = (p0: Vec3, p1: Vec3, p2: Vec3, outward: Vec3) => {
    const e1: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    let normal = cross(e1, e2);
    let a = p1;
    let b = p2;
    if (normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2] < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
      a = p2;
      b = p1;
    }
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    for (const vertex of [p0, a, b]) positions.push(r(vertex[0]), r(vertex[1]), r(vertex[2]));
    for (let i = 0; i < 3; i++) {
      normals.push(r(normal[0] / length), r(normal[1] / length), r(normal[2] / length));
    }
  };

  const quad = (p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, outward: Vec3) => {
    triangle(p0, p1, p2, outward);
    triangle(p0, p2, p3, outward);
  };

  const near = w(-halfRun, eaveY, -halfSpan);
  const nearFar = w(halfRun, eaveY, -halfSpan);
  const far = w(halfRun, eaveY, halfSpan);
  const farNear = w(-halfRun, eaveY, halfSpan);
  const ridgeStart = w(-halfRun, ridgeY, 0);
  const ridgeEnd = w(halfRun, ridgeY, 0);

  quad(near, nearFar, ridgeEnd, ridgeStart, w(0, 1, -1));
  quad(farNear, ridgeStart, ridgeEnd, far, w(0, 1, 1));
  triangle(near, ridgeStart, farNear, w(-1, 0, 0));
  triangle(nearFar, far, ridgeEnd, w(1, 0, 0));

  return { positions, normals, eaveY: r(eaveY), ridgeY: r(ridgeY) };
}

// ── Builder ───────────────────────────────────────────────────────────────

/**
 * Derives the full scene from a persisted plan. Every consumer of the 3D tab
 * goes through here, so the preview can never drift from the 2D drawing.
 */
export function buildScene(plan: FloorPlan, options: BuildSceneOptions = {}): SceneModel {
  const { widthM, lengthM } = plan.house;
  const offsetX = -widthM / 2;
  const offsetZ = -lengthM / 2;

  const floors: SceneFloor[] = plan.floors.map((floor, order) => {
    // `index` is the engine's floor number; `order` guards against gaps.
    const baseY = order * FLOOR_HEIGHT_M;
    const levelY = baseY + SLAB_THICKNESS_M;
    const topY = levelY + WALL_HEIGHT_M;

    const target: WallEmitTarget = { walls: [], glass: [] };
    for (const solid of wallSolids(floor.walls)) {
      emitWall(solid, levelY, offsetX, offsetZ, floor.doors, floor.windows, target);
    }

    const { outline } = floor;

    return {
      index: floor.index,
      baseY: r(baseY),
      levelY: r(levelY),
      topY: r(topY),
      slab: box(0, baseY + SLAB_THICKNESS_M / 2, 0, widthM, SLAB_THICKNESS_M, lengthM),
      finish: box(
        outline.x + outline.width / 2 + offsetX,
        levelY + FLOOR_FINISH_M / 2,
        outline.y + outline.height / 2 + offsetZ,
        outline.width,
        FLOOR_FINISH_M,
        outline.height,
      ),
      walls: target.walls,
      glass: target.glass,
      steps: buildSteps(floor, levelY, offsetX, offsetZ),
    };
  });

  const topFloor = floors[floors.length - 1];
  const wallTopY = topFloor ? topFloor.topY : SLAB_THICKNESS_M;
  const roof = topFloor ? buildRoof(widthM, lengthM, wallTopY) : null;

  const land = options.land;

  // The property, laid out by the engine so the 2D, 3D and PDF views cannot
  // disagree about where the garage is.
  const site = layoutSite({
    land,
    house: { widthM, lengthM, floorCount: plan.floors.length },
    features: options.features ?? null,
  });

  // Site space puts the plot's corner at the origin; scene space puts the
  // *house* centre there. Everything on the plot shifts by the difference,
  // which is what finally lets the house sit toward the street instead of
  // floating in the middle of its own land.
  const siteToWorldX = -(site.house.x + site.house.width / 2);
  const siteToWorldZ = -(site.house.y + site.house.height / 2);

  const plateWidth = Math.max(site.plot.width, widthM + GROUND_MIN_MARGIN_M);
  const plateLength = Math.max(site.plot.height, lengthM + GROUND_MIN_MARGIN_M);
  const plotCenterX = site.plot.width / 2 + siteToWorldX;
  const plotCenterZ = site.plot.height / 2 + siteToWorldZ;

  /**
   * The plot, minus the footprint of anything sunk into it.
   *
   * A pool is a hole in the ground, and with only box geometry the only way to
   * make one is to stop drawing ground there. Splitting the plate into the (at
   * most four) rectangles around the hole is exact for axis-aligned shapes and
   * costs three extra draws; the alternative — a water box overlapping an
   * unbroken plate — leaves two solids fighting for the same pixels.
   */
  function lawnAround(hole: { x: number; y: number; width: number; height: number } | null): SceneBox[] {
    const plate = (x: number, z: number, w: number, d: number): SceneBox =>
      box(
        x + w / 2 + siteToWorldX,
        -GROUND_THICKNESS_M / 2,
        z + d / 2 + siteToWorldZ,
        w,
        GROUND_THICKNESS_M,
        d,
      );

    const { width: W, height: H } = site.plot;
    if (hole === null) return [plate(0, 0, W, H)];

    const x0 = Math.max(0, hole.x);
    const x1 = Math.min(W, hole.x + hole.width);
    const z0 = Math.max(0, hole.y);
    const z1 = Math.min(H, hole.y + hole.height);

    const pieces: SceneBox[] = [];
    if (z0 > EPS) pieces.push(plate(0, 0, W, z0)); // in front of the hole
    if (H - z1 > EPS) pieces.push(plate(0, z1, W, H - z1)); // behind it
    if (x0 > EPS) pieces.push(plate(0, z0, x0, z1 - z0)); // left of it
    if (W - x1 > EPS) pieces.push(plate(x1, z0, W - x1, z1 - z0)); // right of it
    return pieces;
  }

  const sunk = site.elements.find((e) => e.heightM < 0) ?? null;
  const lawn = lawnAround(sunk ? sunk.rect : null);

  const elements: SceneSiteElement[] = site.elements.map((element) => {
    const { rect: rc, heightM, level } = element;
    const baseY = level * FLOOR_HEIGHT_M;

    // Every case deliberately avoids sharing a face with the ground plane.
    let thickness: number;
    let centerY: number;
    if (heightM === 0) {
      // Flush paving: lifted clear of the lawn it sits on.
      thickness = PAVING_THICKNESS_M;
      centerY = baseY + PAVING_LIFT_M + thickness / 2;
    } else if (heightM < 0) {
      // Sunken: the water surface stops just below grade rather than on it.
      thickness = Math.max(0.05, Math.abs(heightM) - SUNK_DROP_M);
      centerY = baseY - SUNK_DROP_M - thickness / 2;
    } else {
      thickness = heightM;
      centerY = baseY + thickness / 2;
    }
    return {
      kind: element.kind,
      box: box(
        rc.x + rc.width / 2 + siteToWorldX,
        centerY,
        rc.y + rc.height / 2 + siteToWorldZ,
        rc.width,
        thickness,
        rc.height,
      ),
    };
  });

  const halfX = widthM / 2 + (roof ? ROOF_OVERHANG_M : 0);
  const halfZ = lengthM / 2 + (roof ? ROOF_OVERHANG_M : 0);
  const height = roof ? roof.ridgeY : wallTopY;

  return {
    engineVersion: plan.engineVersion,
    house: { widthM, lengthM, floorCount: plan.floors.length },
    floors,
    roof,
    ground: box(
      plotCenterX,
      -GROUND_THICKNESS_M / 2,
      plotCenterZ,
      plateWidth,
      GROUND_THICKNESS_M,
      plateLength,
    ),
    site: {
      plot: box(plotCenterX, -GROUND_THICKNESS_M / 2, plotCenterZ, plateWidth, GROUND_THICKNESS_M, plateLength),
      lawn,
      elements,
      hasGarden: site.hasGarden,
    },
    bounds: {
      center: [0, r(height / 2), 0],
      radius: r(Math.hypot(halfX, height / 2, halfZ)),
    },
    siteBounds: {
      center: [r(plotCenterX), r(height / 2), r(plotCenterZ)],
      radius: r(Math.hypot(plateWidth / 2, height / 2, plateLength / 2)),
    },
    heightM: r(height),
  };
}
