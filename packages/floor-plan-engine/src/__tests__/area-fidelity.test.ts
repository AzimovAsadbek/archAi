import { describe, expect, it } from 'vitest';
import { generateFloorPlan } from '../generate-floor-plan';
import { SEED_CONFIG, input, planOf, room } from './fixtures';

/**
 * Area fidelity: what a room is drawn at, versus what was asked for.
 *
 * The engine cannot always honour a declared area — rooms tile a fixed
 * rectangle, so a program that does not add up to its envelope has to be scaled
 * to fit. What it *must* not do is pick one room to absorb the difference,
 * which is the defect these tests pin down: a declared 5 m² bathroom used to be
 * drawn at 11.4 m² while the rooms beside it kept their sizes.
 */
describe('area fidelity', () => {
  /**
   * Placed ÷ requested per floor, for every room that declared a size.
   *
   * Per floor, not per plan: each floor is scaled to its own envelope, so a
   * 5-room ground floor and a 3-room upper floor in the same footprint are
   * legitimately scaled by different factors. Comparing across them would be
   * comparing two different questions.
   */
  function ratiosByFloor(config: Parameters<typeof planOf>[0]): number[][] {
    return planOf(config).floors.map((floor) =>
      floor.rooms
        .filter((r) => r.requestedAreaM2 !== null && r.requestedAreaM2 > 0)
        .map((r) => r.areaM2 / (r.requestedAreaM2 as number)),
    );
  }

  it('scales a program uniformly rather than singling out one room', () => {
    for (const config of [
      SEED_CONFIG,
      // A program far smaller than its envelope — the case that forces scaling.
      input(14, 12, 1, [
        room('BEDROOM', 0, 4, 4),
        room('BATHROOM', 0, 2, 2),
        room('STORAGE', 0, 2, 2),
        room('LAUNDRY', 0, 2, 2),
        room('HALLWAY', 0, 3, 2),
      ]),
      input(10, 9, 1, [room('LIVING_ROOM', 0, 5, 4), room('BATHROOM', 0, 2, 2)]),
    ]) {
      const floors = ratiosByFloor(config);
      expect(floors.flat().length).toBeGreaterThan(0);
      for (const all of floors) {
        if (all.length < 2) continue;
        const spread = Math.max(...all) / Math.min(...all);
        // 1.35 leaves room for the minimum-side clamp, which legitimately
        // widens the narrowest room in a band and nothing else.
        expect(spread).toBeLessThanOrEqual(1.35);
      }
    }
  });

  it('keeps a small declared room small relative to a large one', () => {
    const plan = planOf(input(12, 10, 1, [room('LIVING_ROOM', 0, 6, 5), room('BATHROOM', 0, 2, 2)]));
    const rooms = plan.floors[0]?.rooms ?? [];
    const living = rooms.find((r) => r.type === 'LIVING_ROOM');
    const bath = rooms.find((r) => r.type === 'BATHROOM');
    expect(living && bath).toBeTruthy();
    if (!living || !bath) return;
    // Declared 30 : 4. The placed areas must still read as a living room beside
    // a bathroom, not two rooms of similar size.
    expect(living.areaM2 / bath.areaM2).toBeGreaterThan(4);
  });

  it('never leaves a floor partly undrawn to protect a declared area', () => {
    const result = generateFloorPlan(
      input(14, 12, 1, [room('BEDROOM', 0, 3, 3), room('BATHROOM', 0, 2, 2)]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const floor = result.plan.floors[0];
    expect(floor).toBeDefined();
    if (!floor) return;
    const covered =
      floor.rooms.reduce((sum, r) => sum + r.rect.width * r.rect.height, 0) +
      (floor.corridor ? floor.corridor.width * floor.corridor.height : 0);
    expect(covered).toBeCloseTo(floor.outline.width * floor.outline.height, 6);
  });
});
