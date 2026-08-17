import { describe, expect, it } from 'vitest';
import { GARAGE_WIDTH_M, SETBACK_FRONT_M, SETBACK_SIDE_M } from '../constants';
import { intersectionArea, rectContains } from '../geometry';
import { layoutSite, type SiteInput, type SiteLayout } from '../site';

const HOUSE = { widthM: 11, lengthM: 13, floorCount: 2 };
const ALL_FEATURES = { garage: true, terrace: true, balcony: true, pool: true, garden: true };

function site(overrides: Partial<SiteInput> = {}): SiteLayout {
  return layoutSite({ house: HOUSE, land: { areaM2: 600 }, ...overrides });
}

/** Every hard element plus the house, for overlap checks. */
function solids(layout: SiteLayout): { name: string; rect: (typeof layout)['house'] }[] {
  return [
    { name: 'house', rect: layout.house },
    // A balcony overhangs the front garden by design, and the drive deliberately
    // runs up to the garage door, so those two are excluded from the pairwise test.
    ...layout.elements
      .filter((e) => e.kind !== 'BALCONY')
      .map((e) => ({ name: e.kind, rect: e.rect })),
  ];
}

describe('site layout', () => {
  it('keeps the house and every element inside the plot', () => {
    for (const land of [
      { areaM2: 600 },
      { areaM2: 300 },
      { areaM2: 2000 },
      { areaM2: 600, widthM: 20, lengthM: 30 },
      { areaM2: 450, widthM: 15, lengthM: 30 },
      null,
    ]) {
      const layout = site({ land, features: ALL_FEATURES });
      expect(
        rectContains(layout.plot, layout.house),
        `house escapes the plot for ${JSON.stringify(land)}`,
      ).toBe(true);
      for (const element of layout.elements) {
        expect(
          rectContains(layout.plot, element.rect),
          `${element.kind} escapes the plot for ${JSON.stringify(land)}`,
        ).toBe(true);
      }
    }
  });

  it('never overlaps the house with a ground element', () => {
    const layout = site({ features: ALL_FEATURES });
    const list = solids(layout);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b) continue;
        // The drive ends at the garage door; touching edges are not an overlap.
        if ((a.name === 'DRIVEWAY' && b.name === 'GARAGE') || (a.name === 'GARAGE' && b.name === 'DRIVEWAY')) {
          continue;
        }
        expect(
          intersectionArea(a.rect, b.rect),
          `${a.name} overlaps ${b.name}`,
        ).toBeLessThan(0.01);
      }
    }
  });

  it('places only what was asked for', () => {
    const none = site({ features: {} });
    // The approach to the front door is not a feature to opt into.
    expect(none.elements.map((e) => e.kind)).toEqual(['PATH']);
    expect(none.hasGarden).toBe(false);

    const all = site({ features: ALL_FEATURES });
    const kinds = all.elements.map((e) => e.kind);
    expect(kinds).toContain('GARAGE');
    expect(kinds).toContain('DRIVEWAY');
    expect(kinds).toContain('TERRACE');
    expect(kinds).toContain('POOL');
    expect(kinds).toContain('BALCONY');
    expect(all.hasGarden).toBe(true);
  });

  it('honours a declared plot and derives one from an area', () => {
    const declared = site({ land: { areaM2: 600, widthM: 20, lengthM: 30 } });
    expect(declared.plot.width).toBeCloseTo(20, 6);
    expect(declared.plot.height).toBeCloseTo(30, 6);
    expect(declared.plotDerived).toBe(false);

    const derived = site({ land: { areaM2: 600 } });
    expect(derived.plotDerived).toBe(true);
    // The derived rectangle keeps the requested area and reads as a plot, not a square.
    expect(derived.plot.width * derived.plot.height).toBeCloseTo(600, 0);
    expect(derived.plot.height).toBeGreaterThan(derived.plot.width);
  });

  it('grows a plot that cannot hold the house rather than overhanging it', () => {
    // 6×6 m of land under an 11×13 m house is not a plot; it is a contradiction.
    const layout = site({ land: { areaM2: 36, widthM: 6, lengthM: 6 } });
    expect(layout.plot.width).toBeGreaterThanOrEqual(HOUSE.widthM + 2 * SETBACK_SIDE_M);
    expect(rectContains(layout.plot, layout.house)).toBe(true);
  });

  it('centres the house and sets it back from the street', () => {
    const layout = site({ land: { areaM2: 600, widthM: 20, lengthM: 30 } });
    const leftGap = layout.house.x;
    const rightGap = layout.plot.width - (layout.house.x + layout.house.width);
    expect(leftGap).toBeCloseTo(rightGap, 2);
    expect(layout.house.y).toBeCloseTo(SETBACK_FRONT_M, 6);
  });

  it('drops a feature that will not fit instead of forcing it', () => {
    // A narrow plot has no side yard, so the garage cannot stand beside the house.
    const narrow = site({
      land: { areaM2: 420, widthM: 14, lengthM: 30 },
      features: { garage: true },
    });
    const garage = narrow.elements.find((e) => e.kind === 'GARAGE');
    if (garage) {
      expect(rectContains(narrow.plot, garage.rect)).toBe(true);
      expect(intersectionArea(garage.rect, narrow.house)).toBeLessThan(0.01);
      expect(garage.rect.width).toBeCloseTo(GARAGE_WIDTH_M, 6);
    }

    // A single-storey house has nothing to put a balcony on.
    const bungalow = layoutSite({
      house: { widthM: 11, lengthM: 13, floorCount: 1 },
      land: { areaM2: 600 },
      features: { balcony: true },
    });
    expect(bungalow.elements.some((e) => e.kind === 'BALCONY')).toBe(false);
  });

  it('is deterministic', () => {
    const a = site({ features: ALL_FEATURES });
    const b = site({ features: ALL_FEATURES });
    expect(a).toEqual(b);
  });
});
