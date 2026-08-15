import {
  type FeaturesConfig,
  type HouseConfig,
  type LandConfig,
  LAYOUT_STRATEGIES,
  type LayoutStrategy,
  type ProjectConfiguration,
  type ProjectDto,
  type ProjectListItemDto,
  type RoomConfig,
  type RoomDto,
  validateProjectConfiguration,
} from '@archai/shared';
import { type Prisma, type Project, type Room } from '@prisma/client';

export type ProjectWithRooms = Prisma.ProjectGetPayload<{ include: { rooms: true } }>;
export type ProjectListRow = Prisma.ProjectGetPayload<{
  include: { _count: { select: { rooms: true } } };
}>;

/** `land` is null until an area is stored (see docs/api.md §DTO mapping). */
export function toLandConfig(project: Project): LandConfig | null {
  if (project.landAreaM2 === null) {
    return null;
  }
  return {
    areaM2: project.landAreaM2,
    widthM: project.landWidthM,
    lengthM: project.landLengthM,
  };
}

/** `house` requires width, length and floor count to be complete. */
export function toHouseConfig(project: Project): HouseConfig | null {
  if (project.houseWidthM === null || project.houseLengthM === null || project.floorCount === null) {
    return null;
  }
  return {
    widthM: project.houseWidthM,
    lengthM: project.houseLengthM,
    floorCount: project.floorCount,
    style: project.style,
  };
}

export function toFeaturesConfig(project: Project): FeaturesConfig {
  return {
    garage: project.hasGarage,
    terrace: project.hasTerrace,
    balcony: project.hasBalcony,
    pool: project.hasPool,
    garden: project.hasGarden,
  };
}

export function toRoomConfig(room: Room): RoomConfig {
  return {
    type: room.type,
    floor: room.floor,
    widthM: room.widthM,
    lengthM: room.lengthM,
    label: room.label,
  };
}

export function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function toRoomDtos(rooms: Room[]): RoomDto[] {
  return sortRooms(rooms).map((room) => ({ id: room.id, ...toRoomConfig(room) }));
}

/** DB string → shared union; an unknown stored value degrades to null (BALANCED). */
export function toLayoutStrategy(value: string | null): LayoutStrategy | null {
  return (LAYOUT_STRATEGIES as readonly string[]).includes(value ?? '')
    ? (value as LayoutStrategy)
    : null;
}

export function toProjectConfiguration(project: ProjectWithRooms): ProjectConfiguration {
  return {
    land: toLandConfig(project),
    house: toHouseConfig(project),
    rooms: sortRooms(project.rooms).map(toRoomConfig),
    features: toFeaturesConfig(project),
  };
}

export function toProjectDto(project: ProjectWithRooms): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    land: toLandConfig(project),
    house: toHouseConfig(project),
    features: toFeaturesConfig(project),
    rooms: toRoomDtos(project.rooms),
    layoutStrategy: toLayoutStrategy(project.layoutStrategy),
    validation: validateProjectConfiguration(toProjectConfiguration(project)),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function toProjectListItemDto(project: ProjectListRow): ProjectListItemDto {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    landAreaM2: project.landAreaM2,
    floorCount: project.floorCount,
    style: project.style,
    roomCount: project._count.rooms,
    updatedAt: project.updatedAt.toISOString(),
  };
}
