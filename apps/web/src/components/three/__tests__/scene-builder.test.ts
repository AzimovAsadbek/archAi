import { describe, expect, it } from 'vitest';
import { generateFloorPlan, type FloorPlan, type FloorPlanInput } from '@archai/floor-plan-engine';
import { buildScene, type SceneBox, type SceneModel } from '../scene-builder';

function planFor(input: FloorPlanInput): FloorPlan {
  const result = generateFloorPlan(input);
  if (!result.ok) throw new Error('plan generation failed: ' + JSON.stringify(result.issues));
  return result.plan;
}

const TWO_FLOOR = planFor({ house: { widthM: 12, lengthM: 10, floorCount: 2 }, rooms: [] });
const ONE_FLOOR = planFor({ house: { widthM: 9, lengthM: 8, floorCount: 1 }, rooms: [] });

/** Every box a scene draws, so bounds can be asserted over the whole model. */
function allBoxes(scene: SceneModel): SceneBox[] {
  return [
    scene.ground,
    ...scene.floors.flatMap((f) => [f.slab, f.finish, ...f.walls, ...f.glass, ...f.steps]),
    // Site elements are geometry like any other and must respect the same limits.
    ...scene.site.elements.map((e) => e.box),
  ];
}

const EPS = 1e-3;

describe('buildScene', () => {
  it('is pure and deterministic (identical input → deep-equal model)', () => {
    expect(buildScene(TWO_FLOOR)).toEqual(buildScene(TWO_FLOOR));
    expect(JSON.stringify(buildScene(TWO_FLOOR))).toBe(JSON.stringify(buildScene(TWO_FLOOR)));
  });

  it('carries house provenance and matches the plan floor count', () => {
    const scene = buildScene(TWO_FLOOR);
    expect(scene.house).toEqual({ widthM: 12, lengthM: 10, floorCount: 2 });
    expect(scene.floors).toHaveLength(2);
    expect(scene.engineVersion).toBe(TWO_FLOOR.engineVersion);
  });

  it('centres the structural slab on the origin at the full footprint size', () => {
    const floor = buildScene(TWO_FLOOR).floors[0];
    if (!floor) throw new Error('expected at least one floor');
    expect(floor.slab.center[0]).toBeCloseTo(0, 6);
    expect(floor.slab.center[2]).toBeCloseTo(0, 6);
    expect(floor.slab.size[0]).toBeCloseTo(12, 6);
    expect(floor.slab.size[2]).toBeCloseTo(10, 6);
  });

  it('stacks floors without vertical overlap', () => {
    const { floors } = buildScene(TWO_FLOOR);
    for (let i = 1; i < floors.length; i++) {
      const prev = floors[i - 1];
      const cur = floors[i];
      if (!prev || !cur) continue;
      expect(cur.baseY).toBeGreaterThan(prev.baseY);
      // The upper floor starts at (or above) the level below's wall top.
      expect(cur.baseY).toBeGreaterThanOrEqual(prev.topY - EPS);
    }
  });

  it('keeps every box AABB within the ground plate and under the roof ridge', () => {
    const scene = buildScene(TWO_FLOOR);
    // Measured from the plate's own centre, not the world origin: the house sits
    // toward the street rather than in the middle of its plot, so the plate is
    // deliberately off-centre and only the plot's own extent bounds anything.
    const [plateX, , plateZ] = scene.ground.center;
    const halfX = scene.ground.size[0] / 2 + EPS;
    const halfZ = scene.ground.size[2] / 2 + EPS;
    const maxY = scene.heightM + EPS;

    for (const b of allBoxes(scene)) {
      expect(Math.abs(b.center[0] - plateX) + b.size[0] / 2).toBeLessThanOrEqual(halfX);
      expect(Math.abs(b.center[2] - plateZ) + b.size[2] / 2).toBeLessThanOrEqual(halfZ);
      const bottom = b.center[1] - b.size[1] / 2;
      const top = b.center[1] + b.size[1] / 2;
      expect(bottom).toBeGreaterThanOrEqual(-scene.ground.size[1] - EPS);
      expect(top).toBeLessThanOrEqual(maxY);
    }
  });

  it('builds a gable roof whose ridge sits above the eaves and defines the height', () => {
    const scene = buildScene(TWO_FLOOR);
    const roof = scene.roof;
    if (!roof) throw new Error('expected a roof over the top floor');
    expect(roof.ridgeY).toBeGreaterThan(roof.eaveY);
    expect(scene.heightM).toBeCloseTo(roof.ridgeY, 6);
    // Triangle soup is whole triangles with a matching normal per vertex.
    expect(roof.positions.length % 9).toBe(0);
    expect(roof.normals.length).toBe(roof.positions.length);
    expect(scene.bounds.radius).toBeGreaterThan(0);
  });

  it('emits a stair flight for the upper floor only', () => {
    const upper = buildScene(TWO_FLOOR).floors[0];
    const single = buildScene(ONE_FLOOR).floors[0];
    if (!upper || !single) throw new Error('expected floors');
    expect(upper.steps.length).toBeGreaterThan(0); // flight rises from floor 0
    expect(single.steps).toHaveLength(0); // nothing to climb to
  });

  it('keeps window glass within the wall vertical span', () => {
    for (const scene of [buildScene(TWO_FLOOR), buildScene(ONE_FLOOR)]) {
      for (const floor of scene.floors) {
        for (const pane of floor.glass) {
          const bottom = pane.center[1] - pane.size[1] / 2;
          const top = pane.center[1] + pane.size[1] / 2;
          expect(bottom).toBeGreaterThanOrEqual(floor.levelY - EPS);
          expect(top).toBeLessThanOrEqual(floor.topY + EPS);
        }
      }
    }
  });
});

describe('site depth hygiene', () => {
  /** Vertical span of a box. */
  const spanY = (b: SceneBox): [number, number] => [
    b.center[1] - b.size[1] / 2,
    b.center[1] + b.size[1] / 2,
  ];

  /** Do two boxes overlap on all three axes (a real intersection, not a touch)? */
  function intersects(a: SceneBox, b: SceneBox): boolean {
    const gap = 1e-4;
    for (let axis = 0; axis < 3; axis++) {
      const aCenter = a.center[axis] ?? 0;
      const aSize = a.size[axis] ?? 0;
      const bCenter = b.center[axis] ?? 0;
      const bSize = b.size[axis] ?? 0;
      const aMin = aCenter - aSize / 2;
      const aMax = aCenter + aSize / 2;
      const bMin = bCenter - bSize / 2;
      const bMax = bCenter + bSize / 2;
      if (aMax - bMin <= gap || bMax - aMin <= gap) return false;
    }
    return true;
  }

  const withPool = () =>
    buildScene(TWO_FLOOR, {
      land: { areaM2: 800, widthM: 22, lengthM: 36 },
      features: { garage: true, terrace: true, pool: true, garden: true, balcony: true },
    });

  it('cuts the lawn around a sunken pool instead of overlapping it', () => {
    const scene = withPool();
    const pool = scene.site.elements.find((e) => e.kind === 'POOL');
    expect(pool, 'expected a pool for this configuration').toBeDefined();
    if (!pool) return;

    expect(scene.site.lawn.length).toBeGreaterThan(1);
    for (const piece of scene.site.lawn) {
      expect(intersects(piece, pool.box), 'lawn overlaps the pool').toBe(false);
    }
  });

  it('keeps the pool inside the ground rather than through its underside', () => {
    const scene = withPool();
    const pool = scene.site.elements.find((e) => e.kind === 'POOL');
    if (!pool) return;
    const [poolBottom, poolTop] = spanY(pool.box);
    const [groundBottom] = spanY(scene.ground);
    expect(poolBottom).toBeGreaterThan(groundBottom);
    // Below grade, so its top face never lands on the lawn's.
    expect(poolTop).toBeLessThan(0);
  });

  it('lifts flush paving clear of the ground plane', () => {
    const scene = buildScene(TWO_FLOOR, {
      land: { areaM2: 800, widthM: 22, lengthM: 36 },
      features: { garage: true, garden: true },
    });
    for (const kind of ['DRIVEWAY', 'PATH'] as const) {
      const paving = scene.site.elements.find((e) => e.kind === kind);
      if (!paving) continue;
      const [bottom] = spanY(paving.box);
      // Coplanar with the lawn top (y = 0) is what causes the flicker.
      expect(bottom, `${kind} sits on the ground plane`).toBeGreaterThan(0);
    }
  });
});
