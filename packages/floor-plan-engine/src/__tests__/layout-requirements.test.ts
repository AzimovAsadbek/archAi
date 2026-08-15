import { describe, expect, it } from 'vitest';
import { ROOM_TYPES } from '@archai/shared';
import { checkFeasibility } from '../layout/feasibility';
import { generateBestFloorPlan } from '../layout/optimize';
import { deriveRoomRequirements, ROOM_PROFILES } from '../layout/requirements';
import { scoreFloorPlan } from '../layout/score';
import { LAYOUT_STRATEGIES, resolveStrategy, STRATEGY_CONFIGS } from '../layout/strategies';
import { generateFloorPlan } from '../generate-floor-plan';
import type { FloorPlanInput } from '../types';

const FAMILY: FloorPlanInput = {
  house: { widthM: 12, lengthM: 10, floorCount: 2 },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0 },
    { type: 'KITCHEN', floor: 0 },
    { type: 'DINING_ROOM', floor: 0 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4 },
    { type: 'BEDROOM', floor: 1 },
    { type: 'BATHROOM', floor: 1 },
  ],
};

describe('ROOM_PROFILES', () => {
  it('covers every room type with coherent bounds and a zone', () => {
    for (const type of ROOM_TYPES) {
      const p = ROOM_PROFILES[type];
      expect(p, type).toBeDefined();
      expect(p.minAreaM2).toBeGreaterThan(0);
      expect(p.minAreaM2).toBeLessThan(p.targetAreaM2);
      expect(p.targetAreaM2).toBeLessThan(p.maxAreaM2);
      expect(['PUBLIC', 'PRIVATE', 'SERVICE', 'CIRCULATION']).toContain(p.zone);
    }
    expect(ROOM_PROFILES.BEDROOM.floorAffinity).toBe('UPPER');
    expect(ROOM_PROFILES.LIVING_ROOM.floorAffinity).toBe('GROUND');
  });
});

describe('deriveRoomRequirements', () => {
  it('gives explicit dimensions precedence over profile defaults (§17)', () => {
    const requirements = deriveRoomRequirements(FAMILY);
    const explicit = requirements.find((room) => room.explicitArea);
    const defaulted = requirements.find((room) => room.type === 'KITCHEN');
    expect(explicit?.targetAreaM2).toBe(16); // 4×4 declared, not the 14 m² profile
    expect(defaulted?.targetAreaM2).toBe(ROOM_PROFILES.KITCHEN.targetAreaM2);
    expect(requirements.every((room) => room.priority === 'REQUIRED')).toBe(true);
    expect(requirements).toHaveLength(FAMILY.rooms.length);
  });
});

describe('strategies', () => {
  it('normalizes every strategy to weight sum 1 and distinct policies (§28)', () => {
    for (const id of LAYOUT_STRATEGIES) {
      const sum = Object.values(STRATEGY_CONFIGS[id].weights).reduce((a, b) => a + b, 0);
      expect(sum, id).toBeCloseTo(1, 6);
    }
    expect(STRATEGY_CONFIGS.COMPACT.weights.efficiency).toBeGreaterThan(
      STRATEGY_CONFIGS.OPEN.weights.efficiency,
    );
    expect(STRATEGY_CONFIGS.PRIVACY.weights.zoneGrouping).toBeGreaterThan(
      STRATEGY_CONFIGS.BALANCED.weights.zoneGrouping,
    );
  });

  it('resolves explicit > suggested > BALANCED (§30)', () => {
    expect(resolveStrategy('PRIVACY', 'OPEN')).toBe('PRIVACY');
    expect(resolveStrategy(null, 'OPEN')).toBe('OPEN');
    expect(resolveStrategy('nonsense', 'also-bad')).toBe('BALANCED');
    expect(resolveStrategy(undefined)).toBe('BALANCED');
  });

  it('weights materially change scoring of the same plan (§27)', () => {
    const result = generateFloorPlan(FAMILY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const balanced = scoreFloorPlan(result.plan, STRATEGY_CONFIGS.BALANCED.weights);
    const compact = scoreFloorPlan(result.plan, STRATEGY_CONFIGS.COMPACT.weights);
    // Same components, different weighting — totals differ unless every
    // component were exactly equal, which this plan's mixed scores are not.
    expect(balanced.total).not.toBe(compact.total);
  });
});

describe('feasibility (§25/§26)', () => {
  it('accepts a plausible request', () => {
    const requirements = deriveRoomRequirements(FAMILY);
    expect(checkFeasibility(FAMILY, requirements)).toEqual({ feasible: true });
  });

  it('rejects an impossible request with issues and suggestions before any layout runs', () => {
    const impossible: FloorPlanInput = {
      house: { widthM: 9, lengthM: 9, floorCount: 1 },
      rooms: Array.from({ length: 8 }, () => ({
        type: 'BEDROOM' as const,
        floor: 0,
        widthM: 4,
        lengthM: 4,
      })),
    };
    const result = generateBestFloorPlan(impossible, { seed: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('INFEASIBLE_REQUIREMENTS');
    expect(result.issues[0]?.meta?.requiredAreaM2).toBeGreaterThan(
      Number(result.issues[0]?.meta?.availableAreaM2),
    );
    expect(result.suggestions).toContain('increase_footprint');
    expect(result.suggestions).toContain('add_floor');
  });
});

describe('strategy-aware optimization', () => {
  it('stays deterministic per strategy and reports the resolved strategy', () => {
    const a = generateBestFloorPlan(FAMILY, { seed: 5, strategy: 'PRIVACY' });
    const b = generateBestFloorPlan(FAMILY, { seed: 5, strategy: 'PRIVACY' });
    expect(a).toEqual(b);
    if (a.ok) expect(a.strategy).toBe('PRIVACY');
    const c = generateBestFloorPlan(FAMILY, { seed: 5 });
    if (c.ok) expect(c.strategy).toBe('BALANCED');
  });
});
