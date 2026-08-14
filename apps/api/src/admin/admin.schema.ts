import { type ProjectStatus, PROJECT_STATUSES, type UserRole } from '@archai/shared';
import { z } from 'zod';

/** Hard ceiling for every admin list (docs/admin.md §Backend). */
export const ADMIN_PAGE_SIZE_MAX = 50;
const ADMIN_PAGE_SIZE_DEFAULT = 20;

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(ADMIN_PAGE_SIZE_MAX).default(ADMIN_PAGE_SIZE_DEFAULT),
};

/**
 * Query strings carry `"true"`/`"false"`, never a boolean — `z.coerce.boolean()`
 * would turn `"false"` into `true`, so the two literals are matched explicitly.
 */
const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

// ── Queries ───────────────────────────────────────────────────────────────

export const listAdminUsersQuerySchema = z.object({
  ...paginationShape,
  /** Case-insensitive substring of email or full name. */
  search: z.string().trim().max(120).optional(),
  isActive: booleanFlag,
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const updateAdminUserSchema = z.object({
  isActive: z.boolean(),
});
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export const listAdminProjectsQuerySchema = z.object({
  ...paginationShape,
  /** Case-insensitive substring of the project name. */
  search: z.string().trim().max(120).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});
export type ListAdminProjectsQuery = z.infer<typeof listAdminProjectsQuerySchema>;

/** Rule sets are few; the default page holds the whole history. */
export const listEstimateRulesQuerySchema = z.object({
  page: paginationShape.page,
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_PAGE_SIZE_MAX)
    .default(ADMIN_PAGE_SIZE_MAX),
});
export type ListEstimateRulesQuery = z.infer<typeof listEstimateRulesQuerySchema>;

export const listAuditQuerySchema = z.object({
  ...paginationShape,
  /** Action prefix, e.g. `user.` or the full `user.deactivate`. */
  action: z.string().trim().max(60).optional(),
  actorId: z.string().trim().min(1).max(60).optional(),
});
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

// ── Response DTOs (admin-only shapes; not part of `@archai/shared`) ────────

export interface AdminUserListItemDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  /** Soft-deleted projects are not counted. */
  projectCount: number;
  aiGenerationCount: number;
}

export interface AdminProjectListItemDto {
  id: string;
  name: string;
  status: ProjectStatus;
  ownerEmail: string;
  roomCount: number;
  landAreaM2: number | null;
  updatedAt: string;
}

export interface AdminEstimateRuleDto {
  id: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  /** Stored `EstimateRules` JSON, returned verbatim and validated by the client. */
  data: unknown;
}

export interface AuditLogItemDto {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  /** Null once the acting administrator's account is deleted. */
  actorId: string | null;
  actorEmail: string | null;
  metadata: unknown;
  createdAt: string;
}
