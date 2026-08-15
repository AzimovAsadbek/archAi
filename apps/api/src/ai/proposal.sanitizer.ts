import { type FeaturesProposal, type ProjectProposal, type RoomProposal } from '@archai/ai';
import {
  createProjectSchema,
  type FeaturesConfig,
  featuresConfigSchema,
  houseConfigSchema,
  landConfigSchema,
  LAYOUT_STRATEGIES,
  LIMITS,
  type ProjectConfiguration,
  roomConfigSchema,
} from '@archai/shared';

/**
 * Marks notes the server added, so they stay distinguishable from the model's
 * own assumptions (which are written in the user's language).
 */
export const SERVER_NOTE_PREFIX = '[server]';

const featuresPartialSchema = featuresConfigSchema.partial();

const FEATURE_KEYS = [
  'garage',
  'terrace',
  'balcony',
  'pool',
  'garden',
] as const satisfies readonly (keyof FeaturesConfig)[];

const NO_FEATURES: FeaturesProposal = {
  garage: null,
  terrace: null,
  balcony: null,
  pool: null,
  garden: null,
};

export interface SanitizedProposal {
  /** The proposal as it will be shown, with every rejected block removed. */
  proposal: ProjectProposal;
  /** The same data as a `ProjectConfiguration`, ready for domain validation. */
  configuration: ProjectConfiguration;
}

/**
 * Re-validates a model proposal with the shared schemas — the same ones
 * `PATCH /projects/:id` enforces, so nothing can reach the review panel that the
 * apply step would then reject. A block the schemas refuse is dropped instead of
 * failing the whole answer, and every drop is appended to `assumptions` so the
 * user can see what was thrown away.
 */
export function sanitizeProposal(raw: ProjectProposal): SanitizedProposal {
  const notes: string[] = [];

  const name = keepOrDrop(
    raw.name,
    (value) => createProjectSchema.shape.name.safeParse(value),
    notes,
    'the proposed project name',
  );
  const description = keepOrDrop(
    raw.description,
    (value) => createProjectSchema.shape.description.safeParse(value),
    notes,
    'the proposed description',
  );
  const land = keepOrDrop(
    raw.land,
    (value) => landConfigSchema.safeParse(value),
    notes,
    'the proposed land block',
  );
  const house = keepOrDrop(
    raw.house,
    (value) => houseConfigSchema.safeParse(value),
    notes,
    'the proposed house block',
  );

  const rooms = sanitizeRooms(raw.rooms, notes);
  const features = sanitizeFeatures(raw.features, notes);

  // Defense in depth: the runtime schema already constrains the enum, but a
  // fake/test provider could hand anything through the DI token.
  let layoutStrategy = raw.layoutStrategy ?? null;
  if (layoutStrategy !== null && !(LAYOUT_STRATEGIES as readonly string[]).includes(layoutStrategy)) {
    notes.push(`${SERVER_NOTE_PREFIX} the proposed layout strategy was not recognised and was dropped`);
    layoutStrategy = null;
  }

  const proposal: ProjectProposal = {
    name: name ?? null,
    description: description ?? null,
    land:
      land == null
        ? null
        : { areaM2: land.areaM2, widthM: land.widthM ?? null, lengthM: land.lengthM ?? null },
    house:
      house == null
        ? null
        : {
            widthM: house.widthM,
            lengthM: house.lengthM,
            floorCount: house.floorCount,
            style: house.style ?? null,
          },
    rooms,
    features: features.proposal,
    layoutStrategy,
    detectedLanguage: raw.detectedLanguage,
    assumptions: [...raw.assumptions, ...notes],
    unmappable: raw.unmappable,
  };

  return {
    proposal,
    configuration: {
      land: proposal.land,
      house: proposal.house,
      rooms,
      features: features.config,
    },
  };
}

/** Runs one shared schema over a nullable block, dropping it (with a note) on failure. */
function keepOrDrop<TInput, TOutput>(
  value: TInput | null,
  parse: (value: TInput) => { success: true; data: TOutput } | { success: false },
  notes: string[],
  subject: string,
): TOutput | null {
  if (value === null) {
    return null;
  }
  const result = parse(value);
  if (!result.success) {
    notes.push(`${SERVER_NOTE_PREFIX} ${subject} was outside the supported range and was dropped`);
    return null;
  }
  return result.data;
}

function sanitizeRooms(rooms: RoomProposal[], notes: string[]): RoomProposal[] {
  const kept: RoomProposal[] = [];
  let dropped = 0;

  for (const room of rooms) {
    const result =
      kept.length < LIMITS.rooms.maxPerProject ? roomConfigSchema.safeParse(room) : null;
    if (result === null || !result.success) {
      dropped += 1;
      continue;
    }
    kept.push({
      type: result.data.type,
      floor: result.data.floor,
      widthM: result.data.widthM ?? null,
      lengthM: result.data.lengthM ?? null,
      label: result.data.label ?? null,
    });
  }

  if (dropped > 0) {
    notes.push(
      `${SERVER_NOTE_PREFIX} ${dropped} proposed room(s) could not be used and were dropped`,
    );
  }
  return kept;
}

interface SanitizedFeatures {
  proposal: FeaturesProposal;
  /** Only the features the model answered explicitly reach the configuration. */
  config: Partial<FeaturesConfig>;
}

function sanitizeFeatures(features: FeaturesProposal, notes: string[]): SanitizedFeatures {
  const stated: Partial<FeaturesConfig> = {};
  for (const key of FEATURE_KEYS) {
    const value = features[key];
    if (typeof value === 'boolean') {
      stated[key] = value;
    }
  }

  const result = featuresPartialSchema.safeParse(stated);
  if (!result.success) {
    notes.push(`${SERVER_NOTE_PREFIX} the proposed features were not understood and were dropped`);
    return { proposal: NO_FEATURES, config: {} };
  }
  return { proposal: features, config: result.data };
}
