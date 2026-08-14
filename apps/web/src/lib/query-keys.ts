import { type FinishLevel } from '@archai/shared';
import {
  type ListAdminAuditInput,
  type ListAdminBlogInput,
  type ListAdminFaqInput,
  type ListAdminPricingInput,
  type ListAdminProjectsInput,
  type ListAdminUsersInput,
  type ListProjectsInput,
} from './endpoints';

export const queryKeys = {
  me: ['me'] as const,
  projects: (query: ListProjectsInput) => ['projects', query] as const,
  project: (id: string) => ['project', id] as const,
  floorPlan: (id: string) => ['project', id, 'floor-plan'] as const,
  /** Every finish level of one project — the prefix an edit invalidates. */
  estimates: (id: string) => ['project', id, 'estimate'] as const,
  estimate: (id: string, finishLevel: FinishLevel) =>
    ['project', id, 'estimate', finishLevel] as const,
  /** Admin panel — `['admin']` is the prefix a mutation invalidates wholesale. */
  admin: {
    users: (query: ListAdminUsersInput) => ['admin', 'users', query] as const,
    projects: (query: ListAdminProjectsInput) => ['admin', 'projects', query] as const,
    estimateRules: ['admin', 'estimate-rules'] as const,
    audit: (query: ListAdminAuditInput) => ['admin', 'audit', query] as const,
    faq: (query: ListAdminFaqInput) => ['admin', 'faq', query] as const,
    blog: (query: ListAdminBlogInput) => ['admin', 'blog', query] as const,
    pricing: (query: ListAdminPricingInput) => ['admin', 'pricing', query] as const,
  },
};
