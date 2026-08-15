import { EXTERIOR_WALL_M, STAIR_DEPTH_M, STAIR_WIDTH_M } from '../constants';
import { round1 } from '../geometry';
import type { EngineIssue, FloorPlanInput } from '../types';
import type { RoomRequirement } from './requirements';

/**
 * Cheap area-budget feasibility (§25): run before any candidate is generated,
 * so an impossible request fails in microseconds with an explanation instead of
 * burning the whole candidate budget to discover the same thing. This is an
 * early heuristic on minimum areas — never a structural calculation.
 */

/** Share of a floor's usable area reserved for walls and circulation. */
const CIRCULATION_ALLOWANCE = 0.14;

export type FeasibilitySuggestion =
  | 'increase_footprint'
  | 'add_floor'
  | 'reduce_rooms'
  | 'reduce_room_areas';

export type FeasibilityResult =
  | { feasible: true }
  | { feasible: false; issues: EngineIssue[]; suggestions: FeasibilitySuggestion[] };

export function checkFeasibility(
  input: FloorPlanInput,
  requirements: readonly RoomRequirement[],
): FeasibilityResult {
  const { widthM, lengthM, floorCount } = input.house;
  const usableWidth = widthM - 2 * EXTERIOR_WALL_M;
  const usableLength = lengthM - 2 * EXTERIOR_WALL_M;
  if (usableWidth <= 0 || usableLength <= 0) return { feasible: true }; // engine reports its own INVALID_INPUT

  const issues: EngineIssue[] = [];
  const suggestions = new Set<FeasibilitySuggestion>();

  for (let floor = 0; floor < floorCount; floor++) {
    const rooms = requirements.filter((room) => room.floor === floor);
    if (rooms.length === 0) continue;

    let usable = usableWidth * usableLength;
    // The stair core claims its footprint on every floor of a multi-storey house.
    if (floorCount > 1) usable -= STAIR_WIDTH_M * STAIR_DEPTH_M;
    const budget = usable * (1 - CIRCULATION_ALLOWANCE);
    const requiredArea = rooms.reduce((sum, room) => sum + room.minAreaM2, 0);

    if (requiredArea > budget) {
      issues.push({
        code: 'INFEASIBLE_REQUIREMENTS',
        message: `Floor ${floor + 1} needs ≥ ${round1(requiredArea)} m² of rooms but only ~${round1(budget)} m² is available after walls, stairs and circulation`,
        meta: {
          floor,
          requiredAreaM2: round1(requiredArea),
          availableAreaM2: round1(budget),
          roomCount: rooms.length,
        },
      });
      suggestions.add('increase_footprint');
      suggestions.add('reduce_room_areas');
      if (rooms.length > 1) suggestions.add('reduce_rooms');
      if (floorCount < 3) suggestions.add('add_floor');
    }
  }

  if (issues.length === 0) return { feasible: true };
  return { feasible: false, issues, suggestions: [...suggestions] };
}
