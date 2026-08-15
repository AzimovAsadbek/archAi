import { describe, expect, it } from 'vitest';
import { HOUSE_STYLES } from '@archai/shared';
import { CAMERA_PRESETS } from '../camera-presets';
import { materialsForStyle, STYLE_MATERIALS } from '../scene-palette';

const HEX = /^#[0-9a-f]{6}$/;

describe('STYLE_MATERIALS', () => {
  it('covers every house style with a complete, valid preset', () => {
    for (const style of HOUSE_STYLES) {
      const materials = STYLE_MATERIALS[style];
      expect(materials, style).toBeDefined();
      expect(materials.wall, `${style}.wall`).toMatch(HEX);
      expect(materials.roof, `${style}.roof`).toMatch(HEX);
      expect(materials.floor, `${style}.floor`).toMatch(HEX);
      expect(materials.glass, `${style}.glass`).toMatch(HEX);
      expect(materials.roofRoughness).toBeGreaterThan(0);
      expect(materials.roofRoughness).toBeLessThanOrEqual(1);
    }
  });

  it('falls back to the MODERN preset when no style is chosen', () => {
    expect(materialsForStyle(null)).toBe(STYLE_MATERIALS.MODERN);
    expect(materialsForStyle(undefined)).toBe(STYLE_MATERIALS.MODERN);
    expect(materialsForStyle('CLASSIC')).toBe(STYLE_MATERIALS.CLASSIC);
  });

  it('gives visually distinct roofs across styles (presets are not aliases)', () => {
    const roofs = new Set(HOUSE_STYLES.map((style) => STYLE_MATERIALS[style].roof));
    expect(roofs.size).toBeGreaterThanOrEqual(4);
  });
});

describe('CAMERA_PRESETS', () => {
  it('exposes the five §31 presets with orbit first (the default)', () => {
    expect(CAMERA_PRESETS[0]).toBe('orbit');
    expect([...CAMERA_PRESETS].sort()).toEqual(
      ['front', 'isometric', 'orbit', 'side', 'top'].sort(),
    );
  });
});
