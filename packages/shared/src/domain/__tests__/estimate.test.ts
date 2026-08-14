import { describe, expect, it } from 'vitest';
import { calculateEstimate, IncompleteConfigError } from '../estimate';
import { type EstimateRules, type ProjectConfiguration } from '../..';

/**
 * Mirrors the v1 rules seeded by `apps/api/prisma/seed.ts`. Every expected number
 * below is hand-computed from these — a seed change must break these tests.
 */
const rulesV1 = (): EstimateRules => ({
  version: '1',
  currency: 'UZS',
  structureCostPerM2: 3_500_000,
  finishCostPerM2: { STANDARD: 2_000_000, COMFORT: 3_200_000, PREMIUM: 5_000_000 },
  extraFloorFactor: 1.08,
  features: {
    garage: 60_000_000,
    terrace: 25_000_000,
    balcony: 15_000_000,
    pool: 120_000_000,
    garden: 8_000_000,
  },
  laborShare: 0.35,
  contingencyShare: 0.1,
  rangeShare: 0.15,
});

/** Shape of the seeded demo project: 600 m² land, 11×13 m house, 2 floors. */
const referenceConfig = (): ProjectConfiguration => ({
  land: { areaM2: 600, widthM: 20, lengthM: 30 },
  house: { widthM: 11, lengthM: 13, floorCount: 2, style: 'MODERN' },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0, widthM: 5.5, lengthM: 6 },
    { type: 'KITCHEN', floor: 0, widthM: 3.5, lengthM: 4.5 },
    { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4.5 },
  ],
  features: { garage: true, terrace: true, garden: true },
});

const lineAmount = (result: ReturnType<typeof calculateEstimate>, key: string): number =>
  result.lines.find((line) => line.key === key)?.amount ?? Number.NaN;

// Shared quantities of the reference config:
//   footprint = 11 × 13                       = 143 m²
//   gross     = 143 × 2                       = 286 m²
//   structure = 143 × 3_500_000 × (1 + 1.08)  = 500_500_000 + 540_540_000 = 1_041_040_000
//   features  = garage 60_000_000 + terrace 25_000_000
//             + garden 8_000_000 × 600/100 (= 48_000_000)
//                                             = 133_000_000
const STRUCTURE = 1_041_040_000;
const FEATURES = 133_000_000;

describe('calculateEstimate', () => {
  it('prices the reference configuration at STANDARD finish', () => {
    const result = calculateEstimate(referenceConfig(), rulesV1(), 'STANDARD');

    // finish       = 286 × 2_000_000                          = 572_000_000
    // materials+works = 1_041_040_000 + 572_000_000           = 1_613_040_000
    // labor        = 1_613_040_000 × 0.35                     =   564_564_000
    // materials    = 1_613_040_000 − 564_564_000              = 1_048_476_000
    // contingency  = (1_613_040_000 + 133_000_000) × 0.1      =   174_604_000
    // total        = 1_041_040_000 + 572_000_000
    //              + 133_000_000 + 174_604_000                = 1_920_644_000
    expect(lineAmount(result, 'structure')).toBe(STRUCTURE);
    expect(lineAmount(result, 'finish')).toBe(572_000_000);
    expect(lineAmount(result, 'features')).toBe(FEATURES);
    expect(lineAmount(result, 'labor-info')).toBe(564_564_000);
    expect(lineAmount(result, 'contingency')).toBe(174_604_000);
    expect(result.total).toBe(1_920_644_000);

    // range = 1_920_644_000 × 0.85 = 1_632_547_400 → 1_632_547_000
    //       and         × 1.15 = 2_208_740_600 → 2_208_741_000
    expect(result.rangeMin).toBe(1_632_547_000);
    expect(result.rangeMax).toBe(2_208_741_000);
    // 1_920_644_000 / 286 = 6_715_538.46 → 6_716_000
    expect(result.costPerM2).toBe(6_716_000);

    expect(result.grossFloorAreaM2).toBe(286);
    expect(result.finishLevel).toBe('STANDARD');
    expect(result.rulesVersion).toBe('1');
    expect(result.currency).toBe('UZS');
    expect(result.lines.map((line) => line.key)).toEqual([
      'structure',
      'finish',
      'features',
      'labor-info',
      'contingency',
    ]);
  });

  it('itemizes only the enabled features, in a stable order', () => {
    const result = calculateEstimate(referenceConfig(), rulesV1(), 'STANDARD');

    expect(result.featureLines).toEqual([
      { key: 'garage', amount: 60_000_000 },
      { key: 'terrace', amount: 25_000_000 },
      { key: 'garden', amount: 48_000_000, meta: { landAreaM2: 600, per100M2: 8_000_000 } },
    ]);
    // The itemization always adds up to the `features` line.
    const sum = result.featureLines.reduce((acc, line) => acc + line.amount, 0);
    expect(sum).toBe(lineAmount(result, 'features'));
  });

  it('drops the feature cost when nothing is enabled', () => {
    const config = referenceConfig();
    config.features = null;
    const result = calculateEstimate(config, rulesV1(), 'STANDARD');

    // contingency = 1_613_040_000 × 0.1                       = 161_304_000
    // total       = 1_041_040_000 + 572_000_000 + 161_304_000 = 1_774_344_000
    expect(result.featureLines).toHaveLength(0);
    expect(lineAmount(result, 'features')).toBe(0);
    expect(lineAmount(result, 'contingency')).toBe(161_304_000);
    expect(result.total).toBe(1_774_344_000);
  });

  it('prices a pool and a balcony when enabled', () => {
    const config = referenceConfig();
    config.features = { balcony: true, pool: true };
    const result = calculateEstimate(config, rulesV1(), 'STANDARD');

    // features = balcony 15_000_000 + pool 120_000_000 = 135_000_000
    expect(result.featureLines.map((line) => line.key)).toEqual(['balcony', 'pool']);
    expect(lineAmount(result, 'features')).toBe(135_000_000);
  });

  it('scales the garden with the land area', () => {
    const rules = rulesV1();
    const small = referenceConfig();
    small.land = { areaM2: 300 };
    small.features = { garden: true };
    const large = referenceConfig();
    large.land = { areaM2: 750 };
    large.features = { garden: true };

    // 8_000_000 × 300/100 = 24_000_000 ; 8_000_000 × 750/100 = 60_000_000
    expect(calculateEstimate(small, rules, 'STANDARD').featureLines[0]?.amount).toBe(24_000_000);
    expect(calculateEstimate(large, rules, 'STANDARD').featureLines[0]?.amount).toBe(60_000_000);
  });

  it('charges the extra-floor factor above the ground floor only', () => {
    const rules = rulesV1();
    const config = referenceConfig();
    config.features = null;
    config.house = { widthM: 10, lengthM: 10, floorCount: 1 };
    // 100 × 3_500_000 = 350_000_000
    expect(lineAmount(calculateEstimate(config, rules, 'STANDARD'), 'structure')).toBe(350_000_000);

    config.house = { widthM: 10, lengthM: 10, floorCount: 3 };
    // 350_000_000 × (1 + 1.08 + 1.08) = 350_000_000 + 378_000_000 + 378_000_000
    const three = calculateEstimate(config, rules, 'STANDARD');
    expect(lineAmount(three, 'structure')).toBe(1_106_000_000);
    expect(three.grossFloorAreaM2).toBe(300);
  });

  it('changes the total with the finish level', () => {
    const config = referenceConfig();
    const rules = rulesV1();

    // COMFORT: finish = 286 × 3_200_000 = 915_200_000
    //   contingency = (1_041_040_000 + 915_200_000 + 133_000_000) × 0.1 = 208_924_000
    //   total       = 1_041_040_000 + 915_200_000 + 133_000_000 + 208_924_000 = 2_298_164_000
    const comfort = calculateEstimate(config, rules, 'COMFORT');
    expect(lineAmount(comfort, 'finish')).toBe(915_200_000);
    expect(comfort.total).toBe(2_298_164_000);
    expect(comfort.rangeMin).toBe(1_953_439_000); // × 0.85 = 1_953_439_400
    expect(comfort.rangeMax).toBe(2_642_889_000); // × 1.15 = 2_642_888_600
    expect(comfort.costPerM2).toBe(8_036_000); // / 286 = 8_035_538.46

    // PREMIUM: finish = 286 × 5_000_000 = 1_430_000_000
    //   contingency = (1_041_040_000 + 1_430_000_000 + 133_000_000) × 0.1 = 260_404_000
    //   total       = 1_041_040_000 + 1_430_000_000 + 133_000_000 + 260_404_000 = 2_864_444_000
    const premium = calculateEstimate(config, rules, 'PREMIUM');
    expect(lineAmount(premium, 'finish')).toBe(1_430_000_000);
    expect(premium.total).toBe(2_864_444_000);
    expect(premium.rangeMin).toBe(2_434_777_000); // × 0.85 = 2_434_777_400
    expect(premium.rangeMax).toBe(3_294_111_000); // × 1.15 = 3_294_110_600
    expect(premium.costPerM2).toBe(10_016_000); // / 286 = 10_015_538.46

    // Only the finish tier moved — structure and features are untouched.
    expect(lineAmount(premium, 'structure')).toBe(STRUCTURE);
    expect(lineAmount(premium, 'features')).toBe(FEATURES);
  });

  it('splits materials and labor without changing the total', () => {
    const result = calculateEstimate(referenceConfig(), rulesV1(), 'STANDARD');
    const labor = result.lines.find((line) => line.key === 'labor-info');

    expect(labor?.meta).toEqual({ share: 0.35, materialsAmount: 1_048_476_000 });
    // labor + materials = structure + finish, and neither is added to the total.
    expect((labor?.amount ?? 0) + 1_048_476_000).toBe(
      lineAmount(result, 'structure') + lineAmount(result, 'finish'),
    );
    expect(result.total).toBe(
      lineAmount(result, 'structure') +
        lineAmount(result, 'finish') +
        lineAmount(result, 'features') +
        lineAmount(result, 'contingency'),
    );
  });

  it('rounds every amount to the nearest 1000 UZS', () => {
    const rules: EstimateRules = {
      ...rulesV1(),
      structureCostPerM2: 1_234_590,
      finishCostPerM2: { STANDARD: 900_001, COMFORT: 900_001, PREMIUM: 900_001 },
      extraFloorFactor: 1,
      contingencyShare: 0.12,
    };
    const config: ProjectConfiguration = {
      land: { areaM2: 200 },
      house: { widthM: 5, lengthM: 5, floorCount: 1 },
      rooms: [{ type: 'BEDROOM', floor: 0 }],
      features: null,
    };

    const result = calculateEstimate(config, rules, 'STANDARD');

    // structure   = 25 × 1_234_590 = 30_864_750 → 30_865_000 (up)
    // finish      = 25 ×   900_001 = 22_500_025 → 22_500_000 (down)
    // labor       = 53_365_000 × 0.35 = 18_677_750 → 18_678_000 (up)
    // materials   = 53_365_000 − 18_678_000        = 34_687_000
    // contingency = 53_365_000 × 0.12 =  6_403_800 →  6_404_000 (up)
    // total       = 30_865_000 + 22_500_000 + 0 + 6_404_000 = 59_769_000
    expect(lineAmount(result, 'structure')).toBe(30_865_000);
    expect(lineAmount(result, 'finish')).toBe(22_500_000);
    expect(lineAmount(result, 'labor-info')).toBe(18_678_000);
    expect(lineAmount(result, 'contingency')).toBe(6_404_000);
    expect(result.total).toBe(59_769_000);
    // range = 59_769_000 × 0.85 = 50_803_650 → 50_804_000 (up)
    //       and         × 1.15 = 68_734_350 → 68_734_000 (down)
    expect(result.rangeMin).toBe(50_804_000);
    expect(result.rangeMax).toBe(68_734_000);
    // 59_769_000 / 25 = 2_390_760 → 2_391_000
    expect(result.costPerM2).toBe(2_391_000);

    for (const amount of [...result.lines.map((line) => line.amount), result.total]) {
      expect(amount % 1000).toBe(0);
    }
  });

  it('collapses the range when the rules allow no band', () => {
    const result = calculateEstimate(
      referenceConfig(),
      { ...rulesV1(), rangeShare: 0 },
      'STANDARD',
    );

    expect(result.rangeMin).toBe(result.total);
    expect(result.rangeMax).toBe(result.total);
  });

  it('is pure — the same inputs always produce the same result', () => {
    const first = calculateEstimate(referenceConfig(), rulesV1(), 'COMFORT');
    const second = calculateEstimate(referenceConfig(), rulesV1(), 'COMFORT');

    expect(first).toEqual(second);
  });

  it('throws IncompleteConfigError without a house', () => {
    const config = referenceConfig();
    config.house = null;

    expect(() => calculateEstimate(config, rulesV1(), 'STANDARD')).toThrow(IncompleteConfigError);
    try {
      calculateEstimate(config, rulesV1(), 'STANDARD');
    } catch (error) {
      expect(error).toBeInstanceOf(IncompleteConfigError);
      expect((error as IncompleteConfigError).missing).toEqual(['house']);
      expect((error as IncompleteConfigError).code).toBe('INCOMPLETE_CONFIG');
    }
  });

  it('throws IncompleteConfigError without land, listing every missing block', () => {
    const withoutLand = referenceConfig();
    withoutLand.land = null;
    expect(() => calculateEstimate(withoutLand, rulesV1(), 'STANDARD')).toThrow(
      IncompleteConfigError,
    );

    const empty: ProjectConfiguration = {};
    try {
      calculateEstimate(empty, rulesV1(), 'STANDARD');
      expect.unreachable('an empty configuration cannot be priced');
    } catch (error) {
      expect((error as IncompleteConfigError).missing).toEqual(['land', 'house']);
    }
  });
});
