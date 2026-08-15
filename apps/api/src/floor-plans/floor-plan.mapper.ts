import { createHash } from 'node:crypto';
import {
  scoreFloorPlan,
  type FloorPlan,
  type FloorPlanInput,
} from '@archai/floor-plan-engine';
import { type HouseConfig } from '@archai/shared';
import { type Prisma } from '@prisma/client';
import { isRecord } from '../common/types/request.types';
import { type ProjectWithRooms, sortRooms } from '../projects/project.mapper';

/** One normalized scoring component; the web localizes by `code`. */
export interface LayoutScoreComponentDto {
  code: string;
  /** 0..1 normalized quality. */
  score: number;
  weight: number;
}

/** `GET /projects/:id/floor-plan` response (docs/api.md §Floor plan). */
export interface FloorPlanDto {
  plan: FloorPlan;
  /** ISO-8601 timestamp of the engine run that produced `plan`. */
  generatedAt: string;
  /**
   * Explainable layout quality (§46), recomputed from the plan on every read —
   * `scoreFloorPlan` is pure and deterministic, so cached and fresh responses
   * always agree and nothing new is persisted. BALANCED weights, matching what
   * the optimizer ranked with.
   */
  layout: {
    strategy: 'BALANCED';
    score: { total: number; components: LayoutScoreComponentDto[] };
  };
}

/**
 * Engine input for a project. Only geometry-relevant configuration goes in —
 * `style`, features and names never change the layout, so they must not
 * invalidate a cached plan.
 */
export function toFloorPlanInput(project: ProjectWithRooms, house: HouseConfig): FloorPlanInput {
  return {
    house: {
      widthM: house.widthM,
      lengthM: house.lengthM,
      floorCount: house.floorCount,
    },
    rooms: sortRooms(project.rooms).map((room) => ({
      id: room.id,
      type: room.type,
      floor: room.floor,
      widthM: room.widthM,
      lengthM: room.lengthM,
      label: room.label,
    })),
  };
}

/** Object keys sorted recursively; array order (= room order) is significant and kept. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = canonicalize(value[key]);
      if (entry !== undefined) {
        sorted[key] = entry;
      }
    }
    return sorted;
  }
  return value;
}

/** Stable serialization — identical input always yields the identical string. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? 'null';
}

/** Cache key for a stored plan: sha256 of the canonical engine input, nothing else. */
export function hashFloorPlanInput(input: FloorPlanInput): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex');
}

/** Geometry is stored verbatim; Prisma types JSON columns too loosely to infer it back. */
export function toFloorPlan(geometry: Prisma.JsonValue): FloorPlan {
  return geometry as unknown as FloorPlan;
}

export function toGeometryJson(plan: FloorPlan): Prisma.InputJsonValue {
  return plan as unknown as Prisma.InputJsonValue;
}

export function toFloorPlanDto(plan: FloorPlan, generatedAt: Date): FloorPlanDto {
  const score = scoreFloorPlan(plan);
  return {
    plan,
    generatedAt: generatedAt.toISOString(),
    layout: {
      strategy: 'BALANCED',
      score: {
        total: score.total,
        // Explanations are server-side prose; the web localizes by code.
        components: score.components.map(({ code, score: value, weight }) => ({
          code,
          score: value,
          weight,
        })),
      },
    },
  };
}
