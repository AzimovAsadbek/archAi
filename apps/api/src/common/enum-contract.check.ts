import { type $Enums } from '@prisma/client';
import {
  type HouseStyle as SharedHouseStyle,
  type ProjectStatus as SharedProjectStatus,
  type RoomType as SharedRoomType,
  type UserRole as SharedUserRole,
} from '@archai/shared';

/**
 * Compile-time drift guard. The Prisma schema and `@archai/shared` define the
 * domain enums in parallel; `@archai/shared` is the stated source of truth, but
 * nothing structurally forced the DB enums to match it. These assertions fail
 * the build the moment a value is added, removed or renamed on only one side.
 */
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const _userRole: Equals<$Enums.UserRole, SharedUserRole> = true;
const _houseStyle: Equals<$Enums.HouseStyle, SharedHouseStyle> = true;
const _roomType: Equals<$Enums.RoomType, SharedRoomType> = true;
const _projectStatus: Equals<$Enums.ProjectStatus, SharedProjectStatus> = true;

void _userRole;
void _houseStyle;
void _roomType;
void _projectStatus;
