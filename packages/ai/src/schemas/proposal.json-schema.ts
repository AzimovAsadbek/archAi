import { HOUSE_STYLES, LIMITS, ROOM_TYPES } from '@archai/shared';
import { DETECTED_LANGUAGES, PROPOSAL_LIMITS } from './proposal.schema';

/**
 * Wire JSON Schema for the project proposal, shaped for the subset that both
 * Gemini (`responseJsonSchema`, constrained decoding) and Groq (`json_object`,
 * schema-in-prompt) accept. It mirrors `projectProposalSchema` structurally, but
 * `projectProposalSchema` remains the single source of truth: every provider
 * still `safeParse`s its output against the Zod schema, which additionally
 * enforces the numeric bounds a wire schema's `minimum`/`maximum` may be dropped.
 *
 * Bounds and enums are imported from the same constants the Zod schema uses, so
 * the two cannot silently drift; a test asserts the top-level shape matches.
 *
 * Nullability is expressed as a `["<type>", "null"]` union (JSON Schema 2020-12)
 * rather than OpenAPI's `nullable`, because that is what `responseJsonSchema`
 * expects; nullable enums add `null` as an explicit member.
 */

type JsonSchema = Record<string, unknown>;

const nullableString = (extra: JsonSchema = {}): JsonSchema => ({
  type: ['string', 'null'],
  ...extra,
});

const num = (min: number, max: number, extra: JsonSchema = {}): JsonSchema => ({
  type: 'number',
  minimum: min,
  maximum: max,
  ...extra,
});

const nullableNum = (min: number, max: number, extra: JsonSchema = {}): JsonSchema => ({
  type: ['number', 'null'],
  minimum: min,
  maximum: max,
  ...extra,
});

const landSchema: JsonSchema = {
  type: ['object', 'null'],
  description: 'Land plot, or null when the request says nothing about land.',
  additionalProperties: false,
  required: ['areaM2', 'widthM', 'lengthM'],
  properties: {
    areaM2: num(LIMITS.land.minAreaM2, LIMITS.land.maxAreaM2, {
      description: 'Total land area in m² (1 sotix = 100 m²).',
    }),
    widthM: nullableNum(LIMITS.land.minSideM, LIMITS.land.maxSideM, {
      description: 'Land width in metres, or null when not stated.',
    }),
    lengthM: nullableNum(LIMITS.land.minSideM, LIMITS.land.maxSideM, {
      description: 'Land length in metres, or null when not stated.',
    }),
  },
};

const houseSchema: JsonSchema = {
  type: ['object', 'null'],
  description: 'House. Null unless width, length and floor count are all stated or strongly implied.',
  additionalProperties: false,
  required: ['widthM', 'lengthM', 'floorCount', 'style'],
  properties: {
    widthM: num(LIMITS.house.minSideM, LIMITS.house.maxSideM),
    lengthM: num(LIMITS.house.minSideM, LIMITS.house.maxSideM),
    floorCount: {
      type: 'integer',
      minimum: LIMITS.floors.min,
      maximum: LIMITS.floors.max,
      description: 'Number of floors.',
    },
    style: {
      type: ['string', 'null'],
      enum: [...HOUSE_STYLES, null],
      description: 'Architectural style, or null when the request does not imply one.',
    },
  },
};

const roomSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'floor', 'widthM', 'lengthM', 'label'],
  properties: {
    type: { type: 'string', enum: [...ROOM_TYPES], description: 'Closest room type; OTHER when none fit.' },
    floor: {
      type: 'integer',
      minimum: 0,
      maximum: LIMITS.floors.max - 1,
      description: '0-based floor index (0 = ground floor).',
    },
    widthM: nullableNum(LIMITS.rooms.minSideM, LIMITS.rooms.maxSideM),
    lengthM: nullableNum(LIMITS.rooms.minSideM, LIMITS.rooms.maxSideM),
    label: nullableString({ maxLength: 60, description: "Short label in the user's language, or null." }),
  },
};

const featureFlag: JsonSchema = {
  type: ['boolean', 'null'],
  description: 'true requested, false explicitly ruled out, null not mentioned.',
};

/** The proposal schema in the shape sent over the wire to a provider. */
export const PROPOSAL_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'description',
    'land',
    'house',
    'rooms',
    'features',
    'detectedLanguage',
    'assumptions',
    'unmappable',
  ],
  properties: {
    name: nullableString({
      minLength: LIMITS.project.nameMin,
      maxLength: LIMITS.project.nameMax,
      description: "Short project name in the user's language, or null.",
    }),
    description: nullableString({
      maxLength: LIMITS.project.descriptionMax,
      description: "One-paragraph summary in the user's language, or null.",
    }),
    land: landSchema,
    house: houseSchema,
    rooms: {
      type: 'array',
      maxItems: PROPOSAL_LIMITS.maxRooms,
      items: roomSchema,
      description: `Requested rooms, at most ${PROPOSAL_LIMITS.maxRooms}. Empty when none stated.`,
    },
    features: {
      type: 'object',
      additionalProperties: false,
      required: ['garage', 'terrace', 'balcony', 'pool', 'garden'],
      properties: {
        garage: featureFlag,
        terrace: featureFlag,
        balcony: featureFlag,
        pool: featureFlag,
        garden: featureFlag,
      },
    },
    detectedLanguage: { type: 'string', enum: [...DETECTED_LANGUAGES] },
    assumptions: {
      type: 'array',
      maxItems: PROPOSAL_LIMITS.maxAssumptions,
      items: { type: 'string', maxLength: PROPOSAL_LIMITS.maxNoteChars },
      description: "Guesses the user should confirm, in the user's language.",
    },
    unmappable: {
      type: 'array',
      maxItems: PROPOSAL_LIMITS.maxUnmappable,
      items: { type: 'string', maxLength: PROPOSAL_LIMITS.maxNoteChars },
      description: "Requirements this schema cannot express, or contradictions, in the user's language.",
    },
  },
};

/**
 * Compact rendering of the wire schema for providers that cannot enforce a
 * schema natively (Groq `json_object`): it is appended to the system prompt so
 * the model still sees the exact required keys, types and enums.
 */
export function proposalSchemaForPrompt(): string {
  return JSON.stringify(PROPOSAL_JSON_SCHEMA, null, 2);
}

/**
 * Appended to the system prompt for JSON-mode providers (both Gemini and Groq).
 * Gemini's constrained-decoding schema rejects parts of this JSON Schema
 * (union `type` nullability, `additionalProperties`), so neither provider relies
 * on native schema enforcement — the model sees the exact shape here and Zod
 * re-checks it. This keeps a single, portable normalization pipeline.
 */
export function jsonOutputInstruction(): string {
  return `\n\n# Output format\nRespond with ONLY a single JSON object — no markdown fences, no commentary. It must conform exactly to this JSON Schema (every "required" key present, no extra keys):\n${proposalSchemaForPrompt()}`;
}
