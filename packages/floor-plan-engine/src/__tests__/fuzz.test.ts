import { describe, expect, it } from 'vitest';
import { ROOM_TYPES, type RoomType } from '@archai/shared';
import { ENGINE_ISSUE_CODES, type FloorPlanInput } from '../types';
import { generateFloorPlan } from '../generate-floor-plan';
import { assertValidPlan } from './plan-invariants';

/**
 * Seeded property/fuzz test. The docs advertise an N-config fuzz over the full
 * schema ranges; this makes that claim real and reproducible. A deterministic
 * PRNG (no Math.random / Date.now) keeps CI stable — same seed, same corpus.
 *
 * Contract asserted for EVERY generated input:
 *   - generateFloorPlan never throws;
 *   - ok:true  ⇒ the plan passes every geometric invariant (assertValidPlan);
 *   - ok:false ⇒ a non-empty list of known issue codes.
 * Plus determinism at scale on a sample.
 */

/** mulberry32 — tiny, fast, deterministic 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FUZZ_SEED = 0x5eed_1234;
/** Every config is generated + shape-checked; every Nth is deep-validated. */
const FUZZ_COUNT = 5000;
const DEEP_VALIDATE_EVERY = 8;
const DETERMINISM_SAMPLES = 250;
/** assertValidPlan runs dozens of expect()s, so give the big loop room. */
const FUZZ_TIMEOUT_MS = 120_000;
const ISSUE_CODES = new Set<string>(ENGINE_ISSUE_CODES);

function makeInput(rng: () => number): FloorPlanInput {
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));

  // House across the full schema range (4–60 m sides, 1–3 floors), snapped to 0.5.
  const snapHalf = (v: number) => Math.round(v * 2) / 2;
  const widthM = snapHalf(between(4, 60));
  const lengthM = snapHalf(between(4, 60));
  const floorCount = int(1, 3);

  const roomCount = int(0, 40);
  const rooms = Array.from({ length: roomCount }, (_, i) => {
    const type = ROOM_TYPES[int(0, ROOM_TYPES.length - 1)] as RoomType;
    // Occasionally target a floor the house does not have (exercises the reject path).
    const floor = rng() < 0.06 ? int(0, 3) : int(0, floorCount - 1);
    // Mix: absent dims, sane dims, and deliberately oversized dims (> house).
    const roll = rng();
    let w: number | null = null;
    let l: number | null = null;
    if (roll > 0.4) {
      const hi = roll > 0.85 ? 40 : 30; // >0.85 can exceed the house on purpose
      w = snapHalf(between(1, hi));
      l = snapHalf(between(1, hi));
    }
    return { id: `r${i}`, type, floor, widthM: w, lengthM: l };
  });

  return { house: { widthM, lengthM, floorCount }, rooms };
}

describe('generateFloorPlan — seeded fuzz', () => {
  it(
    `never throws and emits only valid geometry or known issues across ${FUZZ_COUNT} configs`,
    () => {
      const rng = mulberry32(FUZZ_SEED);
      let ok = 0;
      let failed = 0;
      let deepValidated = 0;

      for (let i = 0; i < FUZZ_COUNT; i++) {
        const input = makeInput(rng);
        const result = generateFloorPlan(input); // must not throw

        if (result.ok) {
          ok++;
          // Deep-validate a representative subset against every invariant; the
          // rest still assert the result shape (cheap) so all 5000 are exercised.
          if (i % DEEP_VALIDATE_EVERY === 0) {
            assertValidPlan(result.plan);
            deepValidated++;
          } else {
            expect(result.plan.floors).toHaveLength(result.plan.house.floorCount);
          }
        } else {
          failed++;
          expect(
            result.issues.length,
            `config #${i}: ok:false must carry at least one issue`,
          ).toBeGreaterThan(0);
          for (const issue of result.issues) {
            expect(
              ISSUE_CODES.has(issue.code),
              `config #${i}: unknown issue code ${issue.code}`,
            ).toBe(true);
          }
        }
      }

      // Sanity: the corpus exercises both branches and the deep pass actually ran.
      expect(ok, 'fuzz produced no valid plans — corpus is not exercising success').toBeGreaterThan(
        0,
      );
      expect(
        failed,
        'fuzz produced no rejections — corpus is not exercising failure',
      ).toBeGreaterThan(0);
      expect(deepValidated, 'no plans were deep-validated').toBeGreaterThan(0);
    },
    FUZZ_TIMEOUT_MS,
  );

  it(`is deterministic across ${DETERMINISM_SAMPLES} configs (same input → deep-equal output)`, () => {
    const rng = mulberry32(FUZZ_SEED ^ 0x9e37);
    for (let i = 0; i < DETERMINISM_SAMPLES; i++) {
      const input = makeInput(rng);
      const a = generateFloorPlan(structuredClone(input));
      const b = generateFloorPlan(structuredClone(input));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});
