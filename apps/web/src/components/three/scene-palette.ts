/**
 * Every colour and surface property the 3D preview renders with, in one place.
 *
 * three.js materials cannot read the Tailwind `@theme` custom properties the
 * rest of the app paints with, so the values are literals that mirror
 * `src/app/globals.css` — the roof is the brand accent terracotta and the
 * background is the paper tone, which keeps the canvas sitting inside the page
 * rather than on top of it. Keep the two files in sync when tokens move.
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
  /** Roof tiles — `--color-accent`. */
  roof: '#c2571e',
  /** Stair treads: a touch darker than the walls so the flight reads. */
  step: '#ded9cd',
  /** Muted green land plate. */
  ground: '#9aa87f',
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

/** Ambient + one directional light. No shadow maps in v1 — they cost too much. */
export const SCENE_LIGHTS = {
  ambientIntensity: 1.5,
  directionalIntensity: 2.1,
  /** Direction the sun sits in, relative to the model's bounding radius. */
  directionalOffset: [0.75, 1.25, 0.55] as const,
} as const;
