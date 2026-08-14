import { LIMITS } from '../constants';
import {
  type FeaturesConfig,
  type HouseConfig,
  type LandConfig,
  type RoomConfig,
} from '../schemas/project.schema';

export interface ProjectConfiguration {
  land?: LandConfig | null;
  house?: HouseConfig | null;
  rooms?: RoomConfig[];
  features?: Partial<FeaturesConfig> | null;
}

export const DOMAIN_ISSUES = {
  HOUSE_EXCEEDS_LAND: 'HOUSE_EXCEEDS_LAND',
  HOUSE_WIDTH_EXCEEDS_LAND: 'HOUSE_WIDTH_EXCEEDS_LAND',
  HOUSE_LENGTH_EXCEEDS_LAND: 'HOUSE_LENGTH_EXCEEDS_LAND',
  HIGH_LAND_COVERAGE: 'HIGH_LAND_COVERAGE',
  LAND_DIMENSIONS_MISMATCH: 'LAND_DIMENSIONS_MISMATCH',
  ROOM_ON_MISSING_FLOOR: 'ROOM_ON_MISSING_FLOOR',
  FLOOR_AREA_EXCEEDED: 'FLOOR_AREA_EXCEEDED',
  FLOOR_NEARLY_FULL: 'FLOOR_NEARLY_FULL',
  MISSING_KITCHEN: 'MISSING_KITCHEN',
  MISSING_BATHROOM: 'MISSING_BATHROOM',
  NO_ROOMS: 'NO_ROOMS',
} as const;
export type DomainIssueCode = (typeof DOMAIN_ISSUES)[keyof typeof DOMAIN_ISSUES];

export interface DomainIssue {
  code: DomainIssueCode;
  /** Developer-facing message. UI localizes by `code`. */
  message: string;
  meta?: Record<string, string | number>;
}

export interface DomainValidationResult {
  valid: boolean;
  errors: DomainIssue[];
  warnings: DomainIssue[];
}

/**
 * Business-rule validation of a project configuration. Runs after schema
 * validation; assumes individual values are already range-checked.
 */
export function validateProjectConfiguration(config: ProjectConfiguration): DomainValidationResult {
  const errors: DomainIssue[] = [];
  const warnings: DomainIssue[] = [];
  const { land, house } = config;
  const rooms = config.rooms ?? [];

  if (land?.widthM != null && land?.lengthM != null) {
    const rectArea = land.widthM * land.lengthM;
    // Allow 5% tolerance between declared area and rectangle of declared sides.
    if (Math.abs(rectArea - land.areaM2) / land.areaM2 > 0.05) {
      warnings.push({
        code: DOMAIN_ISSUES.LAND_DIMENSIONS_MISMATCH,
        message: `Declared land area ${land.areaM2} m² does not match width×length = ${rectArea.toFixed(1)} m²`,
        meta: { areaM2: land.areaM2, rectAreaM2: Number(rectArea.toFixed(1)) },
      });
    }
  }

  if (house && land) {
    const footprint = house.widthM * house.lengthM;
    if (footprint > land.areaM2) {
      errors.push({
        code: DOMAIN_ISSUES.HOUSE_EXCEEDS_LAND,
        message: `House footprint ${footprint.toFixed(1)} m² exceeds land area ${land.areaM2} m²`,
        meta: { footprintM2: Number(footprint.toFixed(1)), landAreaM2: land.areaM2 },
      });
    } else if (footprint > land.areaM2 * LIMITS.house.warnCoverageRatio) {
      warnings.push({
        code: DOMAIN_ISSUES.HIGH_LAND_COVERAGE,
        message: `House covers ${Math.round((footprint / land.areaM2) * 100)}% of the land`,
        meta: { coveragePercent: Math.round((footprint / land.areaM2) * 100) },
      });
    }
    if (land.widthM != null && house.widthM > land.widthM) {
      errors.push({
        code: DOMAIN_ISSUES.HOUSE_WIDTH_EXCEEDS_LAND,
        message: `House width ${house.widthM} m exceeds land width ${land.widthM} m`,
        meta: { houseM: house.widthM, landM: land.widthM },
      });
    }
    if (land.lengthM != null && house.lengthM > land.lengthM) {
      errors.push({
        code: DOMAIN_ISSUES.HOUSE_LENGTH_EXCEEDS_LAND,
        message: `House length ${house.lengthM} m exceeds land length ${land.lengthM} m`,
        meta: { houseM: house.lengthM, landM: land.lengthM },
      });
    }
  }

  if (house) {
    rooms.forEach((room, index) => {
      if (room.floor >= house.floorCount) {
        errors.push({
          code: DOMAIN_ISSUES.ROOM_ON_MISSING_FLOOR,
          message: `Room #${index + 1} is on floor ${room.floor + 1} but the house has ${house.floorCount} floor(s)`,
          meta: { roomIndex: index, floor: room.floor, floorCount: house.floorCount },
        });
      }
    });

    const floorArea = house.widthM * house.lengthM;
    for (let floor = 0; floor < house.floorCount; floor++) {
      const sized = rooms.filter(
        (r) => r.floor === floor && r.widthM != null && r.lengthM != null,
      );
      const usedArea = sized.reduce((sum, r) => sum + (r.widthM ?? 0) * (r.lengthM ?? 0), 0);
      if (usedArea > floorArea) {
        errors.push({
          code: DOMAIN_ISSUES.FLOOR_AREA_EXCEEDED,
          message: `Rooms on floor ${floor + 1} occupy ${usedArea.toFixed(1)} m² but the floor plate is ${floorArea.toFixed(1)} m²`,
          meta: { floor, usedM2: Number(usedArea.toFixed(1)), floorM2: Number(floorArea.toFixed(1)) },
        });
      } else if (usedArea > floorArea * LIMITS.rooms.warnFloorFillRatio) {
        warnings.push({
          code: DOMAIN_ISSUES.FLOOR_NEARLY_FULL,
          message: `Rooms on floor ${floor + 1} fill ${Math.round((usedArea / floorArea) * 100)}% of the plate — walls and circulation need space`,
          meta: { floor, fillPercent: Math.round((usedArea / floorArea) * 100) },
        });
      }
    }
  }

  if (rooms.length > 0) {
    if (!rooms.some((r) => r.type === 'KITCHEN')) {
      warnings.push({ code: DOMAIN_ISSUES.MISSING_KITCHEN, message: 'No kitchen configured' });
    }
    if (!rooms.some((r) => r.type === 'BATHROOM')) {
      warnings.push({ code: DOMAIN_ISSUES.MISSING_BATHROOM, message: 'No bathroom configured' });
    }
  } else if (house) {
    warnings.push({ code: DOMAIN_ISSUES.NO_ROOMS, message: 'No rooms configured yet' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** A project is considered fully configured when land, house and rooms exist. */
export function isConfigurationComplete(config: ProjectConfiguration): boolean {
  return Boolean(config.land && config.house && (config.rooms?.length ?? 0) > 0);
}
