import { type LayoutStrategy, type ProjectStatus, type UserRole, type HouseStyle } from '../constants';
import {
  type FeaturesConfig,
  type HouseConfig,
  type LandConfig,
  type RoomConfig,
} from '../schemas/project.schema';
import { type DomainValidationResult } from '../domain/validate-project';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
}

export interface RoomDto extends RoomConfig {
  id: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  land: LandConfig | null;
  house: HouseConfig | null;
  features: FeaturesConfig;
  rooms: RoomDto[];
  /** Layout optimization policy; null means the BALANCED default. */
  layoutStrategy: LayoutStrategy | null;
  validation: DomainValidationResult;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListItemDto {
  id: string;
  name: string;
  status: ProjectStatus;
  landAreaM2: number | null;
  /**
   * House footprint, so a card can draw the building on its plot without
   * fetching the floor plan. This is configuration, not geometry: it describes
   * the same inputs the engine consumes and lays out no rooms, so it introduces
   * no second geometry source.
   */
  houseWidthM: number | null;
  houseLengthM: number | null;
  floorCount: number | null;
  style: HouseStyle | null;
  roomCount: number;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Uniform error contract returned by the API for all failures. */
export interface ApiErrorShape {
  statusCode: number;
  /** Stable machine-readable code, e.g. VALIDATION_ERROR, UNAUTHORIZED. */
  code: string;
  message: string;
  details?: unknown;
}
