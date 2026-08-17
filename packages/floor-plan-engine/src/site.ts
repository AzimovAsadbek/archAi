import {
  DRIVEWAY_MIN_WIDTH_M,
  GARAGE_DEPTH_M,
  GARAGE_WIDTH_M,
  PATH_WIDTH_M,
  PLOT_DEPTH_TO_WIDTH,
  POOL_LENGTH_M,
  POOL_WIDTH_M,
  SITE_GAP_M,
  SETBACK_FRONT_M,
  SETBACK_REAR_M,
  SETBACK_SIDE_M,
  TERRACE_DEPTH_M,
  BALCONY_DEPTH_M,
} from './constants';
import { bottom, clamp, isPositiveFinite, rect, right, snap } from './geometry';
import type { Rect } from './types';

/**
 * The site layer: what surrounds the building.
 *
 * The floor-plan engine draws the house. This draws the property it stands on —
 * where the house sits within the plot, and where the garage, drive, terrace and
 * pool go in the space left over. Without it a configured garden or garage
 * changed the cost estimate and appeared in the PDF's feature list, but nothing
 * was ever drawn: the 3D preview showed a house floating on a blank grey plate.
 *
 * It lives in the engine, beside the plan, because it is the same kind of thing —
 * deterministic geometry derived from the configuration — and the 2D, 3D and PDF
 * views must agree about it. Computing it inside the 3D component would have made
 * a second source of truth for where the garage is.
 *
 * Plan coordinates, matching `generateFloorPlan`: `x` runs across the plot, `y`
 * runs from the street edge (`y = 0`) to the rear boundary. Nothing is ever
 * placed outside the plot, and the hard elements never overlap each other or the
 * house.
 */

export type SiteElementKind = 'GARAGE' | 'DRIVEWAY' | 'PATH' | 'TERRACE' | 'POOL' | 'BALCONY';

export interface SiteElement {
  kind: SiteElementKind;
  rect: Rect;
  /**
   * Extrusion above grade. Flush paving is 0; the pool is negative because it is
   * sunk into the ground rather than raised on it.
   */
  heightM: number;
  /** Storey the element belongs to. 0 is grade; a balcony sits on 1 and up. */
  level: number;
}

export interface SiteLayout {
  /** The plot, always at the origin. */
  plot: Rect;
  /** Where the building footprint sits inside the plot. */
  house: Rect;
  /** Everything else, in a stable order. */
  elements: SiteElement[];
  /** Soft landscape was requested, so open ground reads as lawn rather than bare grade. */
  hasGarden: boolean;
  /** The plot rectangle was inferred from an area (or from nothing) rather than declared. */
  plotDerived: boolean;
}

export interface SiteFeatures {
  garage?: boolean | null;
  terrace?: boolean | null;
  balcony?: boolean | null;
  pool?: boolean | null;
  garden?: boolean | null;
}

export interface SiteInput {
  land?: { areaM2?: number | null; widthM?: number | null; lengthM?: number | null } | null;
  house: { widthM: number; lengthM: number; floorCount: number };
  features?: SiteFeatures | null;
}

/**
 * Plot rectangle for the given land.
 *
 * Declared width×length wins. Failing that an area is turned into a rectangle
 * using a typical residential proportion — deeper than wide — because a plot
 * has to be *some* shape to draw and a square one reads as a car park. Failing
 * even that, the plot is exactly the house plus its setbacks.
 *
 * Whatever the source, the result is never smaller than the house needs: a
 * declared plot that cannot hold the building is widened rather than allowed to
 * produce a house hanging over its own boundary.
 */
function derivePlot(input: SiteInput): { plot: Rect; derived: boolean } {
  const { widthM: houseW, lengthM: houseL } = input.house;
  const minWidth = houseW + 2 * SETBACK_SIDE_M;
  const minLength = houseL + SETBACK_FRONT_M + SETBACK_REAR_M;

  const declaredW = input.land?.widthM;
  const declaredL = input.land?.lengthM;
  const declared = isPositiveFinite(declaredW) && isPositiveFinite(declaredL);

  let width: number;
  let length: number;

  if (declared) {
    width = declaredW;
    length = declaredL;
  } else if (isPositiveFinite(input.land?.areaM2)) {
    // area = w × (w × ratio) ⇒ w = √(area / ratio)
    width = Math.sqrt(input.land.areaM2 / PLOT_DEPTH_TO_WIDTH);
    length = input.land.areaM2 / width;
  } else {
    width = minWidth;
    length = minLength;
  }

  return {
    plot: rect(0, 0, snap(Math.max(width, minWidth)), snap(Math.max(length, minLength))),
    derived: !declared,
  };
}

/**
 * Places the house and, when one was asked for, the garage beside it.
 *
 * The two are positioned together rather than in sequence. Centring the house
 * first and then looking for a leftover side yard is how a 20 m plot with an
 * 11 m house ends up 100 mm short of a garage and dumps it on the street
 * frontage: the house has to move over to make room, which is what a site plan
 * actually does. The house and garage are treated as one composition and
 * centred as a pair.
 */
function placeBuildings(
  plot: Rect,
  house: { widthM: number; lengthM: number },
  wantsGarage: boolean,
): { house: Rect; garageX: number | null } {
  // Surplus depth goes to the rear, which is where a garden actually belongs;
  // the front setback stays at the approach distance a street frontage needs.
  const maxY = snap(plot.height - house.lengthM - SETBACK_REAR_M);
  const y = snap(clamp(SETBACK_FRONT_M, 0, Math.max(0, maxY)));

  if (wantsGarage) {
    const strip = GARAGE_WIDTH_M + SITE_GAP_M;
    const needed = house.widthM + strip + 2 * SETBACK_SIDE_M;
    if (plot.width >= needed) {
      const slack = (plot.width - needed) / 2;
      const garageX = snap(SETBACK_SIDE_M + slack);
      const houseX = snap(garageX + strip);
      return { house: rect(houseX, y, snap(house.widthM), snap(house.lengthM)), garageX };
    }
  }

  const x = snap((plot.width - house.widthM) / 2);
  return { house: rect(x, y, snap(house.widthM), snap(house.lengthM)), garageX: null };
}

/** True when `candidate` fits inside `plot` with no negative or zero side. */
function fitsInPlot(plot: Rect, candidate: Rect): boolean {
  return (
    candidate.width > 0 &&
    candidate.height > 0 &&
    candidate.x >= -1e-6 &&
    candidate.y >= -1e-6 &&
    right(candidate) <= right(plot) + 1e-6 &&
    bottom(candidate) <= bottom(plot) + 1e-6
  );
}

/**
 * Lays out the property.
 *
 * Never throws and never fails: a feature that cannot fit is simply not placed,
 * because a missing terrace is a better answer than a terrace drawn through the
 * boundary fence. Callers that need to know check which kinds came back.
 */
export function layoutSite(input: SiteInput): SiteLayout {
  const { plot, derived } = derivePlot(input);
  const features = input.features ?? {};
  const wantsGarage = features.garage === true;
  const placed = placeBuildings(plot, input.house, wantsGarage);
  const house = placed.house;
  const elements: SiteElement[] = [];

  // ── Garage, and the drive that reaches it ───────────────────────────────
  let garage: Rect | null = null;
  if (wantsGarage) {
    if (placed.garageX !== null) {
      // Beside the house, its door on the same line as the front facade.
      const depth = snap(Math.min(GARAGE_DEPTH_M, plot.height - house.y));
      const candidate = rect(placed.garageX, house.y, GARAGE_WIDTH_M, depth);
      if (depth >= 3 && fitsInPlot(plot, candidate)) garage = candidate;
    }
    if (garage === null) {
      // The plot is too narrow for a side yard: stand it in the front garden.
      const depthFront = snap(Math.min(GARAGE_DEPTH_M, house.y - SITE_GAP_M));
      const candidate = rect(SETBACK_SIDE_M, 0, GARAGE_WIDTH_M, depthFront);
      if (depthFront >= 3 && fitsInPlot(plot, candidate)) garage = candidate;
    }
    if (garage !== null) {
      elements.push({ kind: 'GARAGE', rect: garage, heightM: 2.8, level: 0 });
    }
  }

  // A drive only exists where there is ground to cross: a garage standing on
  // the frontage already opens onto the street.
  if (garage !== null && garage.y > 0) {
    const width = Math.max(DRIVEWAY_MIN_WIDTH_M, garage.width);
    const x = snap(clamp(garage.x, 0, Math.max(0, plot.width - width)));
    elements.push({
      kind: 'DRIVEWAY',
      rect: rect(x, 0, snap(width), snap(garage.y)),
      heightM: 0,
      level: 0,
    });
  }

  // The front door always gets a way to it, garage or not — a house drawn with
  // no approach reads as a model rather than a property.
  if (house.y > 0) {
    // Centred on the front door, not on the plot: with a garage beside it the
    // house sits off-centre, and a path aligned to the plot would arrive at a
    // blank stretch of wall.
    const x = snap(
      clamp(house.x + (house.width - PATH_WIDTH_M) / 2, 0, Math.max(0, plot.width - PATH_WIDTH_M)),
    );
    const candidate = rect(x, 0, PATH_WIDTH_M, snap(house.y));
    // Skip it only when the drive already covers that ground.
    const coveredByDrive =
      garage !== null && garage.y > 0 && x >= garage.x - 1e-6 && right(candidate) <= right(garage) + 1e-6;
    if (!coveredByDrive && fitsInPlot(plot, candidate)) {
      elements.push({ kind: 'PATH', rect: candidate, heightM: 0, level: 0 });
    }
  }

  // ── Terrace against the rear facade ─────────────────────────────────────
  const rearY = bottom(house);
  const rearRoom = snap(plot.height - rearY);
  let terraceEnd = rearY;
  if (features.terrace === true && rearRoom > SITE_GAP_M) {
    const depth = snap(Math.min(TERRACE_DEPTH_M, rearRoom - SITE_GAP_M));
    if (depth > 0) {
      const candidate = rect(house.x, rearY, house.width, depth);
      if (fitsInPlot(plot, candidate)) {
        // Raised a step above grade, the way a deck sits against a house.
        elements.push({ kind: 'TERRACE', rect: candidate, heightM: 0.15, level: 0 });
        terraceEnd = bottom(candidate);
      }
    }
  }

  // ── Pool in the back garden, clear of the terrace ───────────────────────
  if (features.pool === true) {
    const available = snap(plot.height - terraceEnd - SITE_GAP_M);
    const length = snap(Math.min(POOL_LENGTH_M, available - SITE_GAP_M));
    const width = snap(Math.min(POOL_WIDTH_M, plot.width - 2 * SETBACK_SIDE_M));
    if (length >= 2 && width >= 2) {
      const x = snap((plot.width - width) / 2);
      const candidate = rect(x, snap(terraceEnd + SITE_GAP_M), width, length);
      if (fitsInPlot(plot, candidate)) {
        // Negative height: sunk into the ground rather than raised on it.
        elements.push({ kind: 'POOL', rect: candidate, heightM: -1.4, level: 0 });
      }
    }
  }

  // ── Balcony on the street facade ────────────────────────────────────────
  // A building element rather than a site one, but it belongs to the same
  // "what did the user tick" question, and only exists above a ground floor.
  if (features.balcony === true && input.house.floorCount > 1 && house.y >= BALCONY_DEPTH_M) {
    const width = snap(house.width / 2);
    const candidate = rect(
      snap(house.x + (house.width - width) / 2),
      snap(house.y - BALCONY_DEPTH_M),
      width,
      BALCONY_DEPTH_M,
    );
    if (fitsInPlot(plot, candidate)) {
      elements.push({ kind: 'BALCONY', rect: candidate, heightM: 0.12, level: 1 });
    }
  }

  return {
    plot,
    house,
    elements,
    hasGarden: features.garden === true,
    plotDerived: derived,
  };
}
