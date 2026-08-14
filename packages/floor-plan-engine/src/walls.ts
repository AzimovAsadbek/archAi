import { EXTERIOR_WALL_M, INTERIOR_WALL_M } from './constants';
import { edgeKey, edgeToSegment, segment, sharedEdge, snap } from './geometry';
import type { PlacedRoom, Rect, Stair, Wall } from './types';

export type ExteriorSide = 'north' | 'east' | 'south' | 'west';

export const EXTERIOR_SIDES: readonly ExteriorSide[] = ['north', 'east', 'south', 'west'];

export interface WallLayout {
  walls: Wall[];
  /** Wall id per exterior side. */
  exteriorIds: Record<ExteriorSide, string>;
  /** Interior wall id per canonical shared-edge key. */
  interiorByEdge: Map<string, string>;
}

export interface BuildWallsParams {
  floorIndex: number;
  widthM: number;
  lengthM: number;
  /** Rooms in placement order (band order, then left→right). */
  rooms: PlacedRoom[];
  corridor: Rect | null;
  stairs: Stair | null;
}

/**
 * Exterior ring (4 segments, thickness 0.30) plus one interior partition per
 * shared edge between placed regions (rooms, corridor, stair core).
 *
 * Exterior wall centre lines sit half a wall thickness inside the footprint so
 * the 0.30 m wall band occupies exactly [0, 0.30] — which is what makes the
 * usable outline a 0.30 m inset.
 */
export function buildWalls(params: BuildWallsParams): WallLayout {
  const { floorIndex, widthM, lengthM, rooms, corridor, stairs } = params;
  const half = snap(EXTERIOR_WALL_M / 2);
  const left = half;
  const top = half;
  const rightEdge = snap(widthM - half);
  const bottomEdge = snap(lengthM - half);

  const exteriorIds: Record<ExteriorSide, string> = {
    north: `f${floorIndex}-ext-north`,
    east: `f${floorIndex}-ext-east`,
    south: `f${floorIndex}-ext-south`,
    west: `f${floorIndex}-ext-west`,
  };

  const walls: Wall[] = [
    {
      id: exteriorIds.north,
      kind: 'exterior',
      thickness: EXTERIOR_WALL_M,
      segment: segment(left, top, rightEdge, top),
    },
    {
      id: exteriorIds.east,
      kind: 'exterior',
      thickness: EXTERIOR_WALL_M,
      segment: segment(rightEdge, top, rightEdge, bottomEdge),
    },
    {
      id: exteriorIds.south,
      kind: 'exterior',
      thickness: EXTERIOR_WALL_M,
      segment: segment(left, bottomEdge, rightEdge, bottomEdge),
    },
    {
      id: exteriorIds.west,
      kind: 'exterior',
      thickness: EXTERIOR_WALL_M,
      segment: segment(left, top, left, bottomEdge),
    },
  ];

  // Deterministic traversal: rooms in placement order, then corridor, then stairs.
  const regions: Rect[] = rooms.map((room) => room.rect);
  if (corridor) regions.push(corridor);
  if (stairs) regions.push(stairs.rect);

  const interiorByEdge = new Map<string, string>();
  for (let i = 0; i < regions.length; i++) {
    const a = regions[i];
    if (!a) continue;
    for (let j = i + 1; j < regions.length; j++) {
      const b = regions[j];
      if (!b) continue;
      const edge = sharedEdge(a, b);
      if (!edge) continue;
      const key = edgeKey(edge);
      if (interiorByEdge.has(key)) continue;
      const id = `f${floorIndex}-int-${interiorByEdge.size + 1}`;
      interiorByEdge.set(key, id);
      walls.push({
        id,
        kind: 'interior',
        thickness: INTERIOR_WALL_M,
        segment: edgeToSegment(edge),
      });
    }
  }

  return { walls, exteriorIds, interiorByEdge };
}
