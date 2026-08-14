import { type ListProjectsInput } from './endpoints';

export const queryKeys = {
  me: ['me'] as const,
  projects: (query: ListProjectsInput) => ['projects', query] as const,
  project: (id: string) => ['project', id] as const,
};
