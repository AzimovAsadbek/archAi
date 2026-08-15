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
