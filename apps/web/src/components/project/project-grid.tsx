'use client';

import { type ProjectListItemDto } from '@archai/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectCard, type ProjectCardProps } from './project-card';

type GridProps = Omit<ProjectCardProps, 'project' | 'busy'> & {
  projects: ProjectListItemDto[];
  busyId?: string | null;
};

export function ProjectGrid({ projects, busyId, ...actions }: GridProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <ProjectCard project={project} busy={busyId === project.id} {...actions} />
        </li>
      ))}
    </ul>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-md border border-line bg-surface p-5">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="mt-3 h-5 w-24 rounded-sm" />
          <Skeleton className="mt-5 h-4 w-4/5" />
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
