import type {
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
