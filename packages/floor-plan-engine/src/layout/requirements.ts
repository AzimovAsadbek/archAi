import type { RoomType } from '@archai/shared';
import { DEFAULT_ROOM_AREAS } from '../constants';
import { isPositiveFinite, round1 } from '../geometry';
import type { FloorPlanInput } from '../types';

/**
 * The requirements layer (§12/§13): a normalized, engine-facing description of
 * what each room *needs*, distinct from the geometry the engine *produces*.
 * Manual configuration and AI intent both normalize into this one shape, and
 * defaults come from a single profile registry (§16) — never scattered.
 */

/** Semantic zone a room belongs to (§18). Minimal set; extended when needed. */
export type ArchitectureZone = 'PUBLIC' | 'PRIVATE' | 'SERVICE' | 'CIRCULATION';

/** REQUIRED rooms must survive generation; the rest degrade politely (§14). */
export type RoomPriority = 'REQUIRED' | 'PREFERRED' | 'OPTIONAL';

/** Vertical placement a room type prefers on multi-floor houses (§21). */
export type FloorAffinity = 'GROUND' | 'UPPER' | 'ANY';

export interface RoomProfile {
  zone: ArchitectureZone;
  /** Bounds around the shared `DEFAULT_ROOM_AREAS` target (§15). */
  minAreaM2: number;
  targetAreaM2: number;
  maxAreaM2: number;
  floorAffinity: FloorAffinity;
}

/** Min/max derived as stable ratios of the one canonical target table. */
function profile(
  type: RoomType,
  zone: ArchitectureZone,
  floorAffinity: FloorAffinity,
): RoomProfile {
  const target = DEFAULT_ROOM_AREAS[type];
  return {
    zone,
    minAreaM2: round1(target * 0.6),
    targetAreaM2: target,
    maxAreaM2: round1(target * 1.8),
    floorAffinity,
  };
}

/** Central semantic registry for every room type (§16). */
export const ROOM_PROFILES: Record<RoomType, RoomProfile> = {
  LIVING_ROOM: profile('LIVING_ROOM', 'PUBLIC', 'GROUND'),
  DINING_ROOM: profile('DINING_ROOM', 'PUBLIC', 'GROUND'),
  KITCHEN: profile('KITCHEN', 'SERVICE', 'GROUND'),
  BEDROOM: profile('BEDROOM', 'PRIVATE', 'UPPER'),
  OFFICE: profile('OFFICE', 'PRIVATE', 'ANY'),
  BATHROOM: profile('BATHROOM', 'SERVICE', 'ANY'),
  LAUNDRY: profile('LAUNDRY', 'SERVICE', 'ANY'),
  STORAGE: profile('STORAGE', 'SERVICE', 'ANY'),
  HALLWAY: profile('HALLWAY', 'CIRCULATION', 'ANY'),
  OTHER: profile('OTHER', 'PRIVATE', 'ANY'),
};

export interface RoomRequirement {
  /** Matches the engine's room key derivation (id when given). */
  id: string | null;
  type: RoomType;
  priority: RoomPriority;
  /** 0-based floor the caller placed the room on. */
  floor: number;
  zone: ArchitectureZone;
  floorAffinity: FloorAffinity;
  minAreaM2: number;
  targetAreaM2: number;
  maxAreaM2: number;
  /** True when the user declared explicit dimensions — their target wins (§17). */
  explicitArea: boolean;
}

/**
 * Normalizes the engine input into requirements. Precedence (§17): an explicit
 * user width×length overrides the profile target (min/max widen to admit it);
 * everything else falls back to the room profile. Configurator rooms are all
 * user-placed, so every requirement is REQUIRED today — priorities become
 * meaningful when AI intent starts proposing optional rooms.
 */
export function deriveRoomRequirements(input: FloorPlanInput): RoomRequirement[] {
  const specs = Array.isArray(input.rooms) ? input.rooms : [];
  return specs.map((spec) => {
    const base = ROOM_PROFILES[spec.type] ?? ROOM_PROFILES.OTHER;
    const hasDims = isPositiveFinite(spec.widthM) && isPositiveFinite(spec.lengthM);
    const declared = hasDims ? round1((spec.widthM as number) * (spec.lengthM as number)) : null;

    return {
      id: typeof spec.id === 'string' && spec.id.trim().length > 0 ? spec.id.trim() : null,
      type: spec.type,
      priority: 'REQUIRED',
      floor: spec.floor,
      zone: base.zone,
      floorAffinity: base.floorAffinity,
      minAreaM2: declared !== null ? Math.min(base.minAreaM2, declared) : base.minAreaM2,
      targetAreaM2: declared ?? base.targetAreaM2,
      maxAreaM2: declared !== null ? Math.max(base.maxAreaM2, declared) : base.maxAreaM2,
      explicitArea: declared !== null,
    };
  });
}
