'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { FloorPlanErrorState, useFloorPlanQuery } from './floor-plan-query';
import { FloorPlanViewer } from './floor-plan-viewer';

function PanelSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="mt-3 aspect-[4/3] w-full rounded-md" />
      <Skeleton className="mt-4 h-16 w-full rounded-md" />
    </div>
  );
}

export interface FloorPlanPanelProps {
  projectId: string;
  /** Regenerating the plan follows the project — a new value refetches. */
  projectUpdatedAt: string;
  className?: string;
}

export function FloorPlanPanel({ projectId, projectUpdatedAt, className }: FloorPlanPanelProps) {
  const query = useFloorPlanQuery(projectId, projectUpdatedAt);

  if (query.isPending) return <PanelSkeleton />;

  if (query.isError) {
    return (
      <FloorPlanErrorState
        className={className}
        projectId={projectId}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return <FloorPlanViewer className={className} plan={query.data.plan} />;
}
