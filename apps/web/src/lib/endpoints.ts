import type { FloorPlan } from '@archai/floor-plan-engine';
import type {
  AiParseProjectResponse,
  AuthResponse,
  CreateProjectInput,
  EstimateResult,
  EstimateRules,
  FinishLevel,
  ListProjectsQuery,
  LoginInput,
  Paginated,
  ProjectDto,
  ProjectListItemDto,
  ProjectStatus,
  RegisterInput,
  UpdateProjectInput,
  UserDto,
  UserRole,
} from '@archai/shared';
import { apiRequest } from './api';

// ── Auth ──────────────────────────────────────────────────────────────────

export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input });
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input });
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}

// ── Users ─────────────────────────────────────────────────────────────────

export function me(signal?: AbortSignal): Promise<UserDto> {
  return apiRequest<UserDto>('/users/me', { signal });
}

// ── Projects ──────────────────────────────────────────────────────────────

export type ListProjectsInput = Partial<ListProjectsQuery>;

export function listProjects(
  query: ListProjectsInput = {},
  signal?: AbortSignal,
): Promise<Paginated<ProjectListItemDto>> {
  return apiRequest<Paginated<ProjectListItemDto>>('/projects', {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    },
    signal,
  });
}

export function createProject(input: CreateProjectInput): Promise<ProjectDto> {
  return apiRequest<ProjectDto>('/projects', { method: 'POST', body: input });
}

export function getProject(id: string, signal?: AbortSignal): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`/projects/${id}`, { signal });
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`/projects/${id}`, { method: 'PATCH', body: input });
}

export function deleteProject(id: string): Promise<void> {
  return apiRequest<void>(`/projects/${id}`, { method: 'DELETE' });
}

export function archiveProject(id: string): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`/projects/${id}/archive`, { method: 'POST' });
}

export function unarchiveProject(id: string): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`/projects/${id}/unarchive`, { method: 'POST' });
}

export function duplicateProject(id: string): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`/projects/${id}/duplicate`, { method: 'POST' });
}

// ── Floor plan ────────────────────────────────────────────────────────────

/** Contract: docs/api.md → GET /projects/:id/floor-plan. */
export interface FloorPlanResponse {
  plan: FloorPlan;
  /** ISO timestamp of the persisted engine run. */
  generatedAt: string;
}

export function getFloorPlan(
  projectId: string,
  signal?: AbortSignal,
): Promise<FloorPlanResponse> {
  return apiRequest<FloorPlanResponse>(`/projects/${projectId}/floor-plan`, { signal });
}

// ── Estimate ──────────────────────────────────────────────────────────────

/** Contract: docs/estimate.md → GET /projects/:id/estimate. */
export interface EstimateResponse {
  estimate: EstimateResult;
}

export function getProjectEstimate(
  projectId: string,
  finishLevel: FinishLevel,
  signal?: AbortSignal,
): Promise<EstimateResponse> {
  return apiRequest<EstimateResponse>(`/projects/${projectId}/estimate`, {
    query: { finishLevel },
    signal,
  });
}

// ── AI ────────────────────────────────────────────────────────────────────

/**
 * Bounds of the free-text request, mirroring `AI_REQUEST_TEXT` on the API
 * (docs/api.md → POST /ai/parse-project). They are part of the endpoint
 * contract rather than the domain, so they do not live in `@archai/shared`;
 * the server re-checks them and answers 400 with `ai_text_min`/`ai_text_max`.
 */
export const AI_TEXT_LIMITS = { min: 5, max: 2_000 } as const;

export interface ParseProjectRequestBody {
  /** Free-text request in the user's own words; trimmed 5..2000 characters. */
  text: string;
  localeHint?: 'uz' | 'ru' | 'en';
}

/**
 * Turns free text into a reviewable proposal. Nothing is persisted: applying
 * the proposal is an explicit POST /projects + PATCH /projects/:id afterwards.
 */
export function parseProjectRequest(
  body: ParseProjectRequestBody,
  signal?: AbortSignal,
): Promise<AiParseProjectResponse> {
  return apiRequest<AiParseProjectResponse>('/ai/parse-project', {
    method: 'POST',
    body,
    signal,
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────
//
// Contract: docs/admin.md §Backend. Every route is ADMIN-only server-side
// (403 FORBIDDEN otherwise) and audited — the client guard is convenience, not
// authorization.

/** Server caps `pageSize` at 50; the admin tables ask for 20. */
export const ADMIN_PAGE_SIZE = 20;

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  projectCount: number;
  aiGenerationCount: number;
}

export interface ListAdminUsersInput {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

export function listAdminUsers(
  query: ListAdminUsersInput = {},
  signal?: AbortSignal,
): Promise<Paginated<AdminUserRow>> {
  return apiRequest<Paginated<AdminUserRow>>('/admin/users', {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      isActive: query.isActive,
    },
    signal,
  });
}

/** 409 `CANNOT_MODIFY_SELF` / `CANNOT_MODIFY_ADMIN` guard the two forbidden targets. */
export function setAdminUserActive(id: string, isActive: boolean): Promise<AdminUserRow> {
  return apiRequest<AdminUserRow>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: { isActive },
  });
}

export interface AdminProjectRow {
  id: string;
  name: string;
  status: ProjectStatus;
  ownerEmail: string;
  roomCount: number;
  /** Null until the owner has configured the land block. */
  landAreaM2: number | null;
  updatedAt: string;
}

export interface ListAdminProjectsInput {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ProjectStatus;
}

export function listAdminProjects(
  query: ListAdminProjectsInput = {},
  signal?: AbortSignal,
): Promise<Paginated<AdminProjectRow>> {
  return apiRequest<Paginated<AdminProjectRow>>('/admin/projects', {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    },
    signal,
  });
}

export interface AdminEstimateRuleRow {
  id: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  /** Re-validated with `estimateRulesSchema` before it is trusted for display. */
  data: EstimateRules;
}

/** Every version, newest first — not paginated. */
export interface AdminEstimateRulesResponse {
  items: AdminEstimateRuleRow[];
}

export function listAdminEstimateRules(
  signal?: AbortSignal,
): Promise<AdminEstimateRulesResponse> {
  return apiRequest<AdminEstimateRulesResponse>('/admin/estimate-rules', { signal });
}

/** Activates a new ruleset version; 409 `VERSION_EXISTS` when the version is taken. */
export function createAdminEstimateRules(rules: EstimateRules): Promise<AdminEstimateRuleRow> {
  return apiRequest<AdminEstimateRuleRow>('/admin/estimate-rules', {
    method: 'POST',
    body: rules,
  });
}

export interface AdminAuditRow {
  id: string;
  /** Null when the actor account was deleted (FK SetNull). */
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface ListAdminAuditInput {
  page?: number;
  pageSize?: number;
  /** Action prefix, e.g. `user.` or `estimate-rules.activate`. */
  action?: string;
  actorId?: string;
}

export function listAdminAudit(
  query: ListAdminAuditInput = {},
  signal?: AbortSignal,
): Promise<Paginated<AdminAuditRow>> {
  return apiRequest<Paginated<AdminAuditRow>>('/admin/audit', {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      action: query.action,
      actorId: query.actorId,
    },
    signal,
  });
}
