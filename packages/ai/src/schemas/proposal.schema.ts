import { HOUSE_STYLES, LIMITS, ROOM_TYPES } from '@archai/shared';
import { z } from 'zod';

/**
 * Language the request was actually written in. `other` covers everything
 * outside the three supported locales (and unrecognisable mixes).
 */
export const DETECTED_LANGUAGES = ['uz', 'ru', 'en', 'other'] as const;
export type DetectedLanguage = (typeof DETECTED_LANGUAGES)[number];

export const PROPOSAL_LIMITS = {
  maxRooms: LIMITS.rooms.maxPerProject,
  maxAssumptions: 10,
  maxUnmappable: 10,
  /** Hard cap per free-text note, so one runaway string cannot dominate a response. */
  maxNoteChars: 300,
} as const;

/**
 * Free-text note written by the model in the user's own language.
 * Trimmed and capped — notes are displayed verbatim in the review panel.
 */
const noteSchema = z.string().trim().max(PROPOSAL_LIMITS.maxNoteChars, 'note_max');

// ── Configuration blocks (bounds mirror LIMITS from @archai/shared) ────────

export const landProposalSchema = z.object({
  areaM2: z
    .number()
    .min(LIMITS.land.minAreaM2, 'land_area_min')
    .max(LIMITS.land.maxAreaM2, 'land_area_max')
    .describe(
      `Total land area in m² (1 sotix = 100 m²). Between ${LIMITS.land.minAreaM2} and ${LIMITS.land.maxAreaM2}.`,
    ),
  widthM: z
    .number()
    .min(LIMITS.land.minSideM, 'land_side_min')
    .max(LIMITS.land.maxSideM, 'land_side_max')
    .nullable()
    .describe(
      `Land width in metres between ${LIMITS.land.minSideM} and ${LIMITS.land.maxSideM}, or null when not stated.`,
    ),
  lengthM: z
    .number()
    .min(LIMITS.land.minSideM, 'land_side_min')
    .max(LIMITS.land.maxSideM, 'land_side_max')
    .nullable()
    .describe(
      `Land length in metres between ${LIMITS.land.minSideM} and ${LIMITS.land.maxSideM}, or null when not stated.`,
    ),
});
export type LandProposal = z.infer<typeof landProposalSchema>;

export const houseProposalSchema = z.object({
  widthM: z
    .number()
    .min(LIMITS.house.minSideM, 'house_side_min')
    .max(LIMITS.house.maxSideM, 'house_side_max')
    .describe(
      `House width in metres between ${LIMITS.house.minSideM} and ${LIMITS.house.maxSideM}.`,
    ),
  lengthM: z
    .number()
    .min(LIMITS.house.minSideM, 'house_side_min')
    .max(LIMITS.house.maxSideM, 'house_side_max')
    .describe(
      `House length in metres between ${LIMITS.house.minSideM} and ${LIMITS.house.maxSideM}.`,
    ),
  floorCount: z
    .number()
    .int()
    .min(LIMITS.floors.min, 'floors_min')
    .max(LIMITS.floors.max, 'floors_max')
    .describe(`Number of floors, ${LIMITS.floors.min}–${LIMITS.floors.max}.`),
  style: z
    .enum(HOUSE_STYLES)
    .nullable()
    .describe('Architectural style, or null when the request does not imply one.'),
});
export type HouseProposal = z.infer<typeof houseProposalSchema>;

export const roomProposalSchema = z.object({
  type: z.enum(ROOM_TYPES).describe('Closest matching room type; use OTHER when nothing fits.'),
  floor: z
    .number()
    .int()
    .min(0, 'room_floor_min')
    .max(LIMITS.floors.max - 1, 'room_floor_max')
    .describe(`0-based floor index (0 = ground floor), max ${LIMITS.floors.max - 1}.`),
  widthM: z
    .number()
    .min(LIMITS.rooms.minSideM, 'room_side_min')
    .max(LIMITS.rooms.maxSideM, 'room_side_max')
    .nullable()
    .describe(
      `Room width in metres between ${LIMITS.rooms.minSideM} and ${LIMITS.rooms.maxSideM}, or null when not stated.`,
    ),
  lengthM: z
    .number()
    .min(LIMITS.rooms.minSideM, 'room_side_min')
    .max(LIMITS.rooms.maxSideM, 'room_side_max')
    .nullable()
    .describe(
      `Room length in metres between ${LIMITS.rooms.minSideM} and ${LIMITS.rooms.maxSideM}, or null when not stated.`,
    ),
  label: z
    .string()
    .trim()
    .max(60, 'room_label_max')
    .nullable()
    .describe("Short user-facing label in the user's language, or null."),
});
export type RoomProposal = z.infer<typeof roomProposalSchema>;

/**
 * Every feature is answered explicitly: `true` requested, `false` explicitly
 * ruled out, `null` not mentioned at all.
 */
export const featuresProposalSchema = z.object({
  garage: z.boolean().nullable(),
  terrace: z.boolean().nullable(),
  balcony: z.boolean().nullable(),
  pool: z.boolean().nullable(),
  garden: z.boolean().nullable(),
});
export type FeaturesProposal = z.infer<typeof featuresProposalSchema>;

// ── Proposal ──────────────────────────────────────────────────────────────

/**
 * A parsed project request. Everything the user did not state is `null` —
 * the model never invents dimensions. This is a *proposal*: the API re-validates
 * it against the shared schemas and the user reviews it before anything is saved.
 */
export const projectProposalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.project.nameMin, 'name_min')
    .max(LIMITS.project.nameMax, 'name_max')
    .nullable()
    .describe("Short project name in the user's language, or null."),
  description: z
    .string()
    .trim()
    .max(LIMITS.project.descriptionMax, 'description_max')
    .nullable()
    .describe("One-paragraph summary of the request in the user's language, or null."),
  land: landProposalSchema.nullable().describe('Null when the request says nothing about land.'),
  house: houseProposalSchema
    .nullable()
    .describe('Null unless width, length and floor count are all stated or strongly implied.'),
  rooms: z
    .array(roomProposalSchema)
    .max(PROPOSAL_LIMITS.maxRooms, 'too_many_rooms')
    .describe(`Requested rooms, at most ${PROPOSAL_LIMITS.maxRooms}. Empty when none are stated.`),
  features: featuresProposalSchema,
  detectedLanguage: z.enum(DETECTED_LANGUAGES),
  assumptions: z
    .array(noteSchema)
    .max(PROPOSAL_LIMITS.maxAssumptions, 'too_many_assumptions')
    .describe("Guesses you made that the user should confirm, in the user's language."),
  unmappable: z
    .array(noteSchema)
    .max(PROPOSAL_LIMITS.maxUnmappable, 'too_many_unmappable')
    .describe(
      "Requirements this schema cannot express, or contradictions, in the user's language.",
    ),
});
export type ProjectProposal = z.infer<typeof projectProposalSchema>;

/** An empty proposal — the shape returned when nothing could be extracted. */
export function emptyProposal(detectedLanguage: DetectedLanguage = 'other'): ProjectProposal {
  return {
    name: null,
    description: null,
    land: null,
    house: null,
    rooms: [],
    features: { garage: null, terrace: null, balcony: null, pool: null, garden: null },
    detectedLanguage,
    assumptions: [],
    unmappable: [],
  };
}
