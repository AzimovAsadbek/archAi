import { z } from 'zod';
import { HOUSE_STYLES, LIMITS, PROJECT_STATUSES, ROOM_TYPES } from '../constants';

// ── Configuration blocks ──────────────────────────────────────────────────

export const landConfigSchema = z.object({
  /** Total land area in m² (authoritative; sotix is converted client-side). */
  areaM2: z.number().min(LIMITS.land.minAreaM2, 'land_area_min').max(LIMITS.land.maxAreaM2, 'land_area_max'),
  widthM: z
    .number()
    .min(LIMITS.land.minSideM, 'land_side_min')
    .max(LIMITS.land.maxSideM, 'land_side_max')
    .nullish(),
  lengthM: z
    .number()
    .min(LIMITS.land.minSideM, 'land_side_min')
    .max(LIMITS.land.maxSideM, 'land_side_max')
    .nullish(),
});
export type LandConfig = z.infer<typeof landConfigSchema>;

export const houseConfigSchema = z.object({
  widthM: z.number().min(LIMITS.house.minSideM, 'house_side_min').max(LIMITS.house.maxSideM, 'house_side_max'),
  lengthM: z.number().min(LIMITS.house.minSideM, 'house_side_min').max(LIMITS.house.maxSideM, 'house_side_max'),
  floorCount: z.number().int().min(LIMITS.floors.min, 'floors_min').max(LIMITS.floors.max, 'floors_max'),
  style: z.enum(HOUSE_STYLES).nullish(),
});
export type HouseConfig = z.infer<typeof houseConfigSchema>;

export const roomConfigSchema = z.object({
  type: z.enum(ROOM_TYPES),
  /** 0-based floor index. */
  floor: z.number().int().min(0).max(LIMITS.floors.max - 1),
  widthM: z
    .number()
    .min(LIMITS.rooms.minSideM, 'room_side_min')
    .max(LIMITS.rooms.maxSideM, 'room_side_max')
    .nullish(),
  lengthM: z
    .number()
    .min(LIMITS.rooms.minSideM, 'room_side_min')
    .max(LIMITS.rooms.maxSideM, 'room_side_max')
    .nullish(),
  label: z.string().trim().max(60).nullish(),
});
export type RoomConfig = z.infer<typeof roomConfigSchema>;

export const featuresConfigSchema = z.object({
  garage: z.boolean().default(false),
  terrace: z.boolean().default(false),
  balcony: z.boolean().default(false),
  pool: z.boolean().default(false),
  garden: z.boolean().default(false),
});
export type FeaturesConfig = z.infer<typeof featuresConfigSchema>;

// ── API inputs ────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().trim().min(LIMITS.project.nameMin, 'name_min').max(LIMITS.project.nameMax, 'name_max'),
  description: z.string().trim().max(LIMITS.project.descriptionMax, 'description_max').nullish(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Partial configuration update. Any provided block fully replaces that block
 * (rooms are replaced wholesale — deterministic, no diffing).
 */
export const updateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.project.nameMin, 'name_min')
    .max(LIMITS.project.nameMax, 'name_max')
    .optional(),
  description: z.string().trim().max(LIMITS.project.descriptionMax, 'description_max').nullish(),
  land: landConfigSchema.nullish(),
  house: houseConfigSchema.nullish(),
  rooms: z.array(roomConfigSchema).max(LIMITS.rooms.maxPerProject, 'too_many_rooms').optional(),
  features: featuresConfigSchema.partial().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(120).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
