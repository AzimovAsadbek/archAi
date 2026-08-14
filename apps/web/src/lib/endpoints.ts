import type { FloorPlan } from '@archai/floor-plan-engine';
import type {
  AiParseProjectResponse,
  AuthResponse,
  CreateProjectInput,
  ListProjectsQuery,
  LoginInput,
  Paginated,
  ProjectDto,
  ProjectListItemDto,
  RegisterInput,
  UpdateProjectInput,
  UserDto,
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
