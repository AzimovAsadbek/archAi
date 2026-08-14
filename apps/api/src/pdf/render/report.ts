import { type FloorPlan } from '@archai/floor-plan-engine';
import {
  type EstimateResult,
  type FeaturesConfig,
  type HouseConfig,
  type LandConfig,
  type ProjectStatus,
  type RoomConfig,
} from '@archai/shared';
import { type PdfLocale } from '../pdf-strings';

/**
 * Everything the renderer is allowed to know. The service assembles it from the
 * existing services and mappers; the renderer below `render/` derives no domain
 * value of its own — it only lays this out (docs/pdf-export.md §Document).
 */
export interface PdfReport {
  locale: PdfLocale;
  project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    /** Drives both the printed date and the deterministic PDF metadata. */
    updatedAt: Date;
  };
  ownerName: string;
  land: LandConfig;
  house: HouseConfig;
  features: FeaturesConfig;
  rooms: RoomConfig[];
  /**
   * Null when the engine cannot lay this configuration out — the plan section is
   * then omitted rather than faked, and the rest of the report still exports.
   */
  plan: FloorPlan | null;
  estimate: EstimateResult;
}
