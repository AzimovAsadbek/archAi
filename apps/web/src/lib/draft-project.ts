import {
  SOTIX_IN_M2,
  type FeaturesConfig,
  type HouseConfig,
  type HouseStyle,
  type LandConfig,
  type ProjectConfiguration,
  type ProjectDto,
  type RoomConfig,
  type RoomType,
} from '@archai/shared';
import { numberToInput, parseNumberInput, round } from './format';
import { EMPTY_FEATURES } from './project-options';

export type LandUnit = 'sotix' | 'm2';

export interface DraftRoom {
  /** Stable client-side key — rooms are replaced wholesale on save. */
  key: string;
  type: RoomType;
  /** 0-based floor index, matching the shared schema. */
  floor: number;
  widthM: string;
  lengthM: string;
  label: string;
}

export interface DraftState {
  landUnit: LandUnit;
  /** Raw input in the currently selected unit. */
  landArea: string;
  landWidth: string;
  landLength: string;
  houseWidth: string;
  houseLength: string;
  floorCount: number;
  rooms: DraftRoom[];
  features: FeaturesConfig;
  style: HouseStyle | null;
}

let roomKeyCounter = 0;
export function nextRoomKey(): string {
  roomKeyCounter += 1;
  return `room-${roomKeyCounter}`;
}

export function draftFromProject(project: ProjectDto): DraftState {
  return {
    landUnit: 'sotix',
    landArea: project.land ? String(round(project.land.areaM2 / SOTIX_IN_M2, 2)) : '',
    landWidth: numberToInput(project.land?.widthM),
    landLength: numberToInput(project.land?.lengthM),
    houseWidth: numberToInput(project.house?.widthM),
    houseLength: numberToInput(project.house?.lengthM),
    floorCount: project.house?.floorCount ?? 1,
    rooms: project.rooms.map((room) => ({
      key: room.id,
      type: room.type,
      floor: room.floor,
      widthM: numberToInput(room.widthM),
      lengthM: numberToInput(room.lengthM),
      label: room.label ?? '',
    })),
    features: { ...EMPTY_FEATURES, ...project.features },
    style: project.house?.style ?? null,
  };
}

/** Land area normalised to m², regardless of the unit the user is typing in. */
export function draftLandAreaM2(draft: DraftState): number | null {
  const value = parseNumberInput(draft.landArea);
  if (value === null) return null;
  return draft.landUnit === 'sotix' ? round(value * SOTIX_IN_M2, 2) : round(value, 2);
}

export function buildLandInput(draft: DraftState): LandConfig | null {
  const areaM2 = draftLandAreaM2(draft);
  if (areaM2 === null) return null;
  return {
    areaM2,
    widthM: parseNumberInput(draft.landWidth),
    lengthM: parseNumberInput(draft.landLength),
  };
}

export function buildHouseInput(draft: DraftState): HouseConfig | null {
  const widthM = parseNumberInput(draft.houseWidth);
  const lengthM = parseNumberInput(draft.houseLength);
  if (widthM === null || lengthM === null) return null;
  return { widthM, lengthM, floorCount: draft.floorCount, style: draft.style };
}

export function buildRoomsInput(draft: DraftState): RoomConfig[] {
  return draft.rooms.map((room) => ({
    type: room.type,
    floor: room.floor,
    widthM: parseNumberInput(room.widthM),
    lengthM: parseNumberInput(room.lengthM),
    label: room.label.trim() === '' ? null : room.label.trim(),
  }));
}

/** Snapshot used for optimistic, client-side domain validation on the review step. */
export function draftConfiguration(draft: DraftState): ProjectConfiguration {
  return {
    land: buildLandInput(draft),
    house: buildHouseInput(draft),
    rooms: buildRoomsInput(draft),
    features: draft.features,
  };
}

export function roomAreaM2(room: DraftRoom): number | null {
  const width = parseNumberInput(room.widthM);
  const length = parseNumberInput(room.lengthM);
  if (width === null || length === null) return null;
  return round(width * length, 1);
}

export function usedFloorAreaM2(rooms: DraftRoom[], floor: number): number {
  return round(
    rooms
      .filter((room) => room.floor === floor)
      .reduce((sum, room) => sum + (roomAreaM2(room) ?? 0), 0),
    1,
  );
}

export function convertLandArea(value: string, from: LandUnit, to: LandUnit): string {
  if (from === to) return value;
  const parsed = parseNumberInput(value);
  if (parsed === null) return value;
  const converted = to === 'm2' ? parsed * SOTIX_IN_M2 : parsed / SOTIX_IN_M2;
  return String(round(converted, 2));
}
