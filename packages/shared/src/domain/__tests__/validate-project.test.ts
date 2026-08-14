import { describe, expect, it } from 'vitest';
import {
  DOMAIN_ISSUES,
  isConfigurationComplete,
  validateProjectConfiguration,
} from '../validate-project';
import { type ProjectConfiguration, type RoomConfig } from '../..';

const validConfig = (): ProjectConfiguration => ({
  land: { areaM2: 600, widthM: 20, lengthM: 30 },
  house: { widthM: 10, lengthM: 12, floorCount: 2, style: 'MODERN' },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0, widthM: 5, lengthM: 6 },
    { type: 'KITCHEN', floor: 0, widthM: 3, lengthM: 4 },
    { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4 },
  ],
  features: { garage: true, terrace: true },
});

describe('validateProjectConfiguration', () => {
  it('accepts a coherent configuration', () => {
    const result = validateProjectConfiguration(validConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a house footprint larger than the land', () => {
    const config = validConfig();
    config.land = { areaM2: 100 };
    config.house = { widthM: 20, lengthM: 20, floorCount: 1 };
    const result = validateProjectConfiguration(config);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain(DOMAIN_ISSUES.HOUSE_EXCEEDS_LAND);
  });

  it('rejects house sides longer than land sides', () => {
    const config = validConfig();
    config.land = { areaM2: 600, widthM: 15, lengthM: 40 };
    config.house = { widthM: 16, lengthM: 12, floorCount: 1 };
    const result = validateProjectConfiguration(config);
    expect(result.errors.map((e) => e.code)).toContain(DOMAIN_ISSUES.HOUSE_WIDTH_EXCEEDS_LAND);
  });

  it('warns on high land coverage without failing', () => {
    const config = validConfig();
    config.land = { areaM2: 150 };
    config.house = { widthM: 10, lengthM: 12, floorCount: 2 };
    const result = validateProjectConfiguration(config);
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain(DOMAIN_ISSUES.HIGH_LAND_COVERAGE);
  });

  it('rejects rooms on floors the house does not have', () => {
    const config = validConfig();
    config.house = { ...config.house!, floorCount: 1 };
    const result = validateProjectConfiguration(config);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain(DOMAIN_ISSUES.ROOM_ON_MISSING_FLOOR);
  });

  it('rejects room area exceeding the floor plate', () => {
    const config = validConfig();
    config.rooms = [
      { type: 'LIVING_ROOM', floor: 0, widthM: 10, lengthM: 12 },
      { type: 'KITCHEN', floor: 0, widthM: 5, lengthM: 5 },
    ];
    const result = validateProjectConfiguration(config);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain(DOMAIN_ISSUES.FLOOR_AREA_EXCEEDED);
  });

  it('warns about missing kitchen and bathroom', () => {
    const config = validConfig();
    config.rooms = [{ type: 'BEDROOM', floor: 0, widthM: 4, lengthM: 4 }];
    const result = validateProjectConfiguration(config);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain(DOMAIN_ISSUES.MISSING_KITCHEN);
    expect(codes).toContain(DOMAIN_ISSUES.MISSING_BATHROOM);
  });

  it('warns when declared land area disagrees with declared sides', () => {
    const config = validConfig();
    config.land = { areaM2: 600, widthM: 10, lengthM: 10 };
    const result = validateProjectConfiguration(config);
    expect(result.warnings.map((w) => w.code)).toContain(DOMAIN_ISSUES.LAND_DIMENSIONS_MISMATCH);
  });

  it('validates rooms without declared dimensions gracefully', () => {
    const config = validConfig();
    config.rooms = config.rooms!.map((r): RoomConfig => ({ ...r, widthM: null, lengthM: null }));
    const result = validateProjectConfiguration(config);
    expect(result.valid).toBe(true);
  });
});

describe('isConfigurationComplete', () => {
  it('is complete with land, house and rooms', () => {
    expect(isConfigurationComplete(validConfig())).toBe(true);
  });

  it('is incomplete without a house', () => {
    const config = validConfig();
    config.house = null;
    expect(isConfigurationComplete(config)).toBe(false);
  });

  it('is incomplete without rooms', () => {
    const config = validConfig();
    config.rooms = [];
    expect(isConfigurationComplete(config)).toBe(false);
  });
});
