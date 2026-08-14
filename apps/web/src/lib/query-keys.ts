import { type FinishLevel } from '@archai/shared';
import { type ListProjectsInput } from './endpoints';

export const queryKeys = {
  me: ['me'] as const,
  projects: (query: ListProjectsInput) => ['projects', query] as const,
  project: (id: string) => ['project', id] as const,
  floorPlan: (id: string) => ['project', id, 'floor-plan'] as const,
  /** Every finish level of one project — the prefix an edit invalidates. */
  estimates: (id: string) => ['project', id, 'estimate'] as const,
  estimate: (id: string, finishLevel: FinishLevel) =>
    ['project', id, 'estimate', finishLevel] as const,
};
