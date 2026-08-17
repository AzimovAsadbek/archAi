export * from './types';
export * from './constants';
export { generateFloorPlan } from './generate-floor-plan';
export { intersectionArea, pointOnSegment, rectArea, rectContains, round1, snap } from './geometry';
export {
  generateBestFloorPlan,
  type BestFloorPlanResult,
  type LayoutGenerationOptions,
} from './layout/optimize';
export { scoreFloorPlan, LAYOUT_WEIGHTS, type LayoutScore, type LayoutScoreComponent } from './layout/score';
export { adjacencyScore, rectsAdjacent, DEFAULT_ADJACENCY } from './layout/adjacency';
export {
  deriveRoomRequirements,
  ROOM_PROFILES,
  type ArchitectureZone,
  type FloorAffinity,
  type RoomPriority,
  type RoomProfile,
  type RoomRequirement,
} from './layout/requirements';
export { checkFeasibility, type FeasibilityResult, type FeasibilitySuggestion } from './layout/feasibility';
export {
  LAYOUT_STRATEGIES,
  resolveStrategy,
  STRATEGY_CONFIGS,
  type LayoutStrategy,
  type LayoutStrategyConfig,
  type LayoutWeights,
} from './layout/strategies';
export {
  layoutSite,
  type SiteElement,
  type SiteElementKind,
  type SiteFeatures,
  type SiteInput,
  type SiteLayout,
} from './site';
