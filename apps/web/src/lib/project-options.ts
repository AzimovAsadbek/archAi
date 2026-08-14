import {
  Car,
  Fence,
  Trees,
  Umbrella,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { type FeaturesConfig, type RoomType } from '@archai/shared';

export const FEATURE_KEYS = [
  'garage',
  'terrace',
  'balcony',
  'pool',
  'garden',
] as const satisfies readonly (keyof FeaturesConfig)[];

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_ICONS: Record<FeatureKey, LucideIcon> = {
  garage: Car,
  terrace: Umbrella,
  balcony: Fence,
  pool: Waves,
  garden: Trees,
};

export const EMPTY_FEATURES: FeaturesConfig = {
  garage: false,
  terrace: false,
  balcony: false,
  pool: false,
  garden: false,
};

/** Types offered as one-tap chips; the rest live behind the "other" dropdown. */
export const QUICK_ROOM_TYPES = [
  'BEDROOM',
  'LIVING_ROOM',
  'KITCHEN',
  'BATHROOM',
  'DINING_ROOM',
] as const satisfies readonly RoomType[];

export type QuickRoomType = (typeof QUICK_ROOM_TYPES)[number];

export function isQuickRoomType(type: RoomType): type is QuickRoomType {
  return (QUICK_ROOM_TYPES as readonly RoomType[]).includes(type);
}
