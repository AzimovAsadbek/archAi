import type { HouseStyle } from '@archai/shared';

/**
 * Every colour and surface property the 3D preview renders with, in one place.
 *
 * three.js materials cannot read the Tailwind `@theme` custom properties the
 * rest of the app paints with, so the values are literals.
 *
 * Only the *background* mirrors a token (`--color-paper`), because the canvas
 * has to sit inside the page rather than on top of it. Everything else is a
 * building material and is deliberately independent of the UI palette: a brand
 * colour change must not repaint the architecture.
 */
export const SCENE_COLORS = {
  /** Canvas clear colour — `--color-paper`. */
  background: '#f7f6f2',
  /** Matte plaster on every wall solid. */
  wall: '#f3f1ea',
  /** Exposed slab edge, concrete. */
  slab: '#cfccc2',
  /** Wood-tone floor finish seen in the cutaway views. */
  floor: '#c19a6b',
  /** Glazing — rendered translucent, not refractive. */
  glass: '#8fb3c4',
  /**
   * Roof tiles — clay. This used to mirror `--color-accent`, which was wrong
   * even before the accent moved to indigo: a roof colour is a *material*, and
   * tying it to the UI accent meant a brand change would have repainted the
   * building. It is now independent, and `STYLE_MATERIALS` overrides it per
   * style anyway.
   */
  roof: '#b0562a',
  /** Stair treads: a touch darker than the walls so the flight reads. */
  step: '#ded9cd',
  /**
   * Neutral site plate. Previously a muted green lawn, which read as a game
   * ground plane and fought the building for attention; a desaturated stone
   * grade lets the facade carry the colour.
   */
  ground: '#d8d6ce',
  /** Sky term of the hemisphere fill — cool, slightly blue. */
  skyLight: '#eef2f6',
  /** Ground bounce term — warm, picked up off the site plate. */
  bounceLight: '#b9b3a5',
} as const;

/** Roughness/metalness per surface, tuned for the single-directional-light setup. */
export const SCENE_SURFACES = {
  wall: { roughness: 0.94, metalness: 0 },
  slab: { roughness: 0.95, metalness: 0 },
  floor: { roughness: 0.72, metalness: 0 },
  roof: { roughness: 0.82, metalness: 0 },
  step: { roughness: 0.9, metalness: 0 },
  ground: { roughness: 1, metalness: 0 },
  /**
   * Opacity rather than `transmission`: transmissive materials force an extra
   * scene render every frame, which defeats the on-demand frame loop.
   */
  glass: { roughness: 0.08, metalness: 0.05, opacity: 0.35 },
} as const;

/**
 * Ambient + hemisphere fill + one shadow-casting sun.
 *
 * Ambient drops from 1.5 to 0.55: with shadow maps on, the old flat ambient
 * washed them straight back out. The hemisphere light replaces most of what
 * ambient was doing while still letting undersides fall into shade, which is
 * what gives the massing its depth.
 */
export const SCENE_LIGHTS = {
  ambientIntensity: 0.55,
  hemisphereIntensity: 0.9,
  directionalIntensity: 2.4,
  /** Direction the sun sits in, relative to the model's bounding radius. */
  directionalOffset: [0.75, 1.25, 0.55] as const,
} as const;

// ── Style-aware materials ─────────────────────────────────────────────────

export interface StyleMaterials {
  wall: string;
  roof: string;
  /** Wood finish inside the cutaway views. */
  floor: string;
  glass: string;
  /** Roughness override for the roof — metal reads shinier than clay. */
  roofRoughness: number;
}

/**
 * Presentation presets per architectural style (§56): the selected style tunes
 * materials only — the geometry is identical for every style, so switching a
 * style never moves a wall. Values are hand-tuned against the single-light
 * setup; the default (no style chosen) is the MODERN set.
 *
 * MODERN      — cool white render walls, dark flat-seam roof, blue glazing.
 * MINIMALIST  — restrained warm greys, near-black roof, neutral glass.
 * CLASSIC     — cream plaster, clay-tile terracotta roof, warmer wood.
 * TRADITIONAL — sandy lime-wash walls, deep clay roof, honey wood.
 * EUROPEAN    — light stone walls, slate roof, cooler wood.
 * NATIONAL    — warm adobe tones, weathered clay roof, rich wood.
 */
export const STYLE_MATERIALS: Record<HouseStyle, StyleMaterials> = {
  MODERN: {
    wall: '#f4f4f2',
    roof: '#4a4d52',
    floor: '#b7906a',
    glass: '#7fa8c9',
    roofRoughness: 0.55,
  },
  MINIMALIST: {
    wall: '#efede8',
    roof: '#2f3134',
    floor: '#c4b49a',
    glass: '#9fb2bd',
    roofRoughness: 0.6,
  },
  CLASSIC: {
    wall: '#f3ecdd',
    roof: '#b0562a',
    floor: '#a97e52',
    glass: '#8fb3c4',
    roofRoughness: 0.85,
  },
  TRADITIONAL: {
    wall: '#efe3cd',
    roof: '#9c4a22',
    floor: '#b28352',
    glass: '#93b0ba',
    roofRoughness: 0.88,
  },
  EUROPEAN: {
    wall: '#eeeae2',
    roof: '#57606c',
    floor: '#9d7a55',
    glass: '#87a7c0',
    roofRoughness: 0.7,
  },
  NATIONAL: {
    wall: '#ead9bd',
    roof: '#8f4d26',
    floor: '#a2703f',
    glass: '#98b1b8',
    roofRoughness: 0.86,
  },
};

/** Materials for a nullable style — the MODERN preset is the neutral default. */
export function materialsForStyle(style: HouseStyle | null | undefined): StyleMaterials {
  return style ? STYLE_MATERIALS[style] : STYLE_MATERIALS.MODERN;
}

// ── Site surfaces ─────────────────────────────────────────────────────────

export interface SurfaceMaterial {
  color: string;
  roughness: number;
  metalness: number;
  /** Set for translucent surfaces; absent means opaque. */
  opacity?: number;
}

/**
 * The property around the building.
 *
 * Each surface is the material it actually is, because that is what makes a
 * plot read as a plot: lawn is not "green ground", it is a rough matte surface
 * that takes shadow badly; water is smooth and translucent; a drive is coarse
 * mineral paving. Rendering them all as the same grey plate is what made the
 * old preview look like a model on a desk rather than a house on its land.
 */
export const SITE_SURFACES = {
  /** Mown lawn. Desaturated well below "grass green", which reads as a game. */
  lawn: { color: '#8ea36b', roughness: 1, metalness: 0 },
  /** Bare grade where no garden was asked for. */
  grade: { color: '#d8d6ce', roughness: 1, metalness: 0 },
  /** Vehicle paving — coarse mineral, mid grey. */
  driveway: { color: '#9c9a94', roughness: 0.95, metalness: 0 },
  /** Foot paving, a shade lighter so a path reads as separate from a drive. */
  path: { color: '#b8b5ad', roughness: 0.92, metalness: 0 },
  /** Timber deck. */
  terrace: { color: '#a87f57', roughness: 0.78, metalness: 0 },
  /** Pool water — smooth and translucent, lit from the sky rather than textured. */
  pool: { color: '#2f7f9e', roughness: 0.06, metalness: 0.1, opacity: 0.82 },
  /** Garage: rendered as a subordinate mass, slightly darker than the house. */
  garage: { color: '#e6e3da', roughness: 0.94, metalness: 0 },
  /** Balcony slab, matching the house's concrete rather than its render. */
  balcony: { color: '#cfccc2', roughness: 0.9, metalness: 0 },
  /** Planting massed in the garden. */
  foliage: { color: '#5f7a4a', roughness: 1, metalness: 0 },
  trunk: { color: '#6b563f', roughness: 1, metalness: 0 },
} as const satisfies Record<string, SurfaceMaterial>;

