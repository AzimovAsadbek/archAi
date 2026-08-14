'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check, Loader2, TriangleAlert } from 'lucide-react';
import {
  houseConfigSchema,
  landConfigSchema,
  LIMITS,
  roomConfigSchema,
  validateProjectConfiguration,
  type DomainIssue,
  type ProjectDto,
  type UpdateProjectInput,
} from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  buildHouseInput,
  buildLandInput,
  buildRoomsInput,
  draftConfiguration,
  draftFromProject,
  type DraftState,
} from '@/lib/draft-project';
import { getProject, updateProject } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';
import { Stepper } from './stepper';
import { ValidationPanel } from './validation-panel';
import { FeaturesStep } from './steps/features-step';
import { HouseStep } from './steps/house-step';
import { LandStep } from './steps/land-step';
import { ReviewStep } from './steps/review-step';
import { RoomsStep } from './steps/rooms-step';
import { StyleStep } from './steps/style-step';

const STEP_IDS = ['land', 'house', 'rooms', 'features', 'style', 'review'] as const;
type StepId = (typeof STEP_IDS)[number];

const roomsSchema = z.array(roomConfigSchema).max(LIMITS.rooms.maxPerProject, 'too_many_rooms');

type FieldErrors = Record<string, string | undefined>;

interface StepValidation {
  errors: FieldErrors;
  patch: UpdateProjectInput | null;
}

function firstIncompleteStep(project: ProjectDto): number {
  if (!project.land) return 0;
  if (!project.house) return 1;
  if (project.rooms.length === 0) return 2;
  return STEP_IDS.length - 1;
}

function issuePath(path: ReadonlyArray<PropertyKey>): string {
  return path.map((part) => String(part)).join('.');
}

function SaveIndicator({
  state,
  labels,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  labels: { saving: string; saved: string; error: string };
}) {
  if (state === 'idle') return null;

  return (
    <span
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold',
        state === 'error' ? 'text-danger' : state === 'saved' ? 'text-success' : 'text-ink-faint',
      )}
    >
      {state === 'saving' ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : state === 'saved' ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <TriangleAlert className="size-3.5" aria-hidden="true" />
      )}
      {state === 'saving' ? labels.saving : state === 'saved' ? labels.saved : labels.error}
    </span>
  );
}

export function Configurator({ projectId }: { projectId: string }) {
  const t = useTranslations('wizard');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
  });
  const project = projectQuery.data;

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [domainIssues, setDomainIssues] = useState<DomainIssue[]>([]);
  const [topError, setTopError] = useState<string | undefined>();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!project || initializedFor === project.id) return;
    const start = firstIncompleteStep(project);
    setDraft(draftFromProject(project));
    setInitializedFor(project.id);
    setStepIndex(start);
    setMaxReached(start);
  }, [project, initializedFor]);

  const update = useCallback(
    (patchOrFn: Partial<DraftState> | ((current: DraftState) => Partial<DraftState>)) => {
      setDraft((current) => {
        if (!current) return current;
        // Functional patches always see the latest state, so rapid successive
        // updates (e.g. quick-add room clicks) compose instead of overwriting.
        const patch = typeof patchOrFn === 'function' ? patchOrFn(current) : patchOrFn;
        const merged = { ...current, ...patch };
        // Shrinking the house must not strand rooms on a floor that no longer exists.
        if (patch.floorCount !== undefined) {
          merged.rooms = merged.rooms.map((room) =>
            room.floor > patch.floorCount! - 1 ? { ...room, floor: patch.floorCount! - 1 } : room,
          );
        }
        return merged;
      });
      setSaveState('idle');
    },
    [],
  );

  const saveMutation = useMutation({
    mutationFn: (patch: UpdateProjectInput) => updateProject(projectId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.project(projectId), updated);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const liveValidation = useMemo(
    () => (draft ? validateProjectConfiguration(draftConfiguration(draft)) : null),
    [draft],
  );

  const validateStep = useCallback(
    (current: DraftState, step: StepId): StepValidation => {
      const stepErrors: FieldErrors = {};

      if (step === 'land') {
        const land = buildLandInput(current);
        if (!land) {
          stepErrors['areaM2'] = fieldError('required');
          return { errors: stepErrors, patch: null };
        }
        const parsed = landConfigSchema.safeParse(land);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            stepErrors[issuePath(issue.path)] = fieldError(issue.message);
          }
          return { errors: stepErrors, patch: null };
        }
        return { errors: stepErrors, patch: { land: parsed.data } };
      }

      if (step === 'house') {
        const house = buildHouseInput(current);
        if (!house) {
          if (current.houseWidth.trim() === '') stepErrors['widthM'] = fieldError('required');
          if (current.houseLength.trim() === '') stepErrors['lengthM'] = fieldError('required');
          if (Object.keys(stepErrors).length === 0) {
            stepErrors['widthM'] = fieldError('number_required');
            stepErrors['lengthM'] = fieldError('number_required');
          }
          return { errors: stepErrors, patch: null };
        }
        const parsed = houseConfigSchema.safeParse(house);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            stepErrors[issuePath(issue.path)] = fieldError(issue.message);
          }
          return { errors: stepErrors, patch: null };
        }
        return { errors: stepErrors, patch: { house: parsed.data } };
      }

      if (step === 'rooms') {
        const parsed = roomsSchema.safeParse(buildRoomsInput(current));
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const path = issuePath(issue.path);
            stepErrors[path === '' ? 'rooms' : `rooms.${path}`] = fieldError(issue.message);
          }
          return { errors: stepErrors, patch: null };
        }
        return { errors: stepErrors, patch: { rooms: parsed.data } };
      }

      if (step === 'features') {
        return { errors: stepErrors, patch: { features: current.features } };
      }

      if (step === 'style') {
        const house = buildHouseInput(current);
        if (!house) {
          stepErrors['style'] = fieldError('required');
          return { errors: stepErrors, patch: null };
        }
        return { errors: stepErrors, patch: { house } };
      }

      // Review: persist everything one last time.
      const land = buildLandInput(current);
      const house = buildHouseInput(current);
      const patch: UpdateProjectInput = {
        rooms: buildRoomsInput(current),
        features: current.features,
      };
      if (land) patch.land = land;
      if (house) patch.house = house;
      return { errors: stepErrors, patch };
    },
    [fieldError],
  );

  const handleApiFailure = useCallback(
    (error: unknown) => {
      setSaveState('error');
      if (error instanceof ApiError && error.code === 'DOMAIN_VALIDATION_ERROR') {
        // Contract (docs/api.md): details = { errors: DomainIssue[], warnings: DomainIssue[] }.
        const details = error.details as
          | { errors?: DomainIssue[]; warnings?: DomainIssue[] }
          | DomainIssue[]
          | undefined;
        const issues = Array.isArray(details)
          ? details
          : [...(details?.errors ?? []), ...(details?.warnings ?? [])];
        setDomainIssues(issues);
        setTopError(undefined);
        return;
      }
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        const nextErrors: FieldErrors = {};
        if (Array.isArray(error.details)) {
          for (const raw of error.details as Array<{ path?: unknown; message?: unknown }>) {
            if (typeof raw?.message !== 'string') continue;
            const path = Array.isArray(raw.path)
              ? raw.path.map((part) => String(part)).join('.')
              : '';
            // Strip the block prefix so it matches the per-step field names.
            const normalized = path.replace(/^(land|house)\./, '');
            nextErrors[normalized] = fieldError(raw.message);
          }
        }
        setErrors(nextErrors);
        setTopError(apiErrorMessage(error));
        return;
      }
      setTopError(apiErrorMessage(error));
    },
    [apiErrorMessage, fieldError],
  );

  const goToStep = useCallback((index: number) => {
    setErrors({});
    setDomainIssues([]);
    setTopError(undefined);
    setStepIndex(index);
  }, []);

  const handleNext = async () => {
    if (!draft) return;
    const stepId = STEP_IDS[stepIndex];
    if (!stepId) return;

    const { errors: stepErrors, patch } = validateStep(draft, stepId);
    setErrors(stepErrors);
    setDomainIssues([]);
    setTopError(undefined);

    if (!patch) {
      setSaveState('idle');
      return;
    }

    setSaveState('saving');
    try {
      await saveMutation.mutateAsync(patch);
      setSaveState('saved');
      if (stepIndex === STEP_IDS.length - 1) {
        router.push(`/projects/${projectId}`);
        return;
      }
      const next = stepIndex + 1;
      setStepIndex(next);
      setMaxReached((value) => Math.max(value, next));
    } catch (error) {
      handleApiFailure(error);
    }
  };

  if (projectQuery.isPending || !draft) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-8 w-64" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-8 h-80 w-full rounded-md" />
      </div>
    );
  }

  if (projectQuery.isError) {
    return (
      <EmptyState
        tone="danger"
        icon={<TriangleAlert className="size-5" />}
        title={t('loadError')}
        description={apiErrorMessage(projectQuery.error)}
        action={
          <Button variant="outline" onClick={() => projectQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        }
      />
    );
  }

  const archived = project?.status === 'ARCHIVED';
  const disabled = archived || saveState === 'saving';
  const stepId = STEP_IDS[stepIndex] ?? 'land';
  const stepProps = { draft, update, errors, disabled };
  const isLastStep = stepIndex === STEP_IDS.length - 1;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t('backToProject')}
        </Link>
        <SaveIndicator
          state={saveState}
          labels={{ saving: t('save.saving'), saved: t('save.saved'), error: t('save.error') }}
        />
      </div>

      <h1 className="mt-4 truncate text-2xl font-extrabold tracking-tight text-ink">
        {project?.name}
      </h1>
      <p className="numeric mt-1 text-sm text-ink-faint">
        {t('stepOf', { current: stepIndex + 1, total: STEP_IDS.length })}
      </p>

      <div className="mt-6">
        <Stepper
          label={t('stepperLabel')}
          steps={STEP_IDS.map((id) => ({ id, label: t(`steps.${id}`) }))}
          currentIndex={stepIndex}
          maxReachedIndex={maxReached}
          onSelect={goToStep}
          disabled={saveState === 'saving'}
        />
      </div>

      {archived ? (
        <Alert tone="warning" className="mt-6">
          {t('archivedNotice')}
        </Alert>
      ) : null}

      {topError ? (
        <Alert tone="danger" live className="mt-6">
          {topError}
        </Alert>
      ) : null}

      {domainIssues.length > 0 ? (
        <ValidationPanel
          className="mt-6"
          errors={domainIssues}
          warnings={[]}
        />
      ) : null}

      <div className="mt-8 rounded-md border border-line bg-surface p-6 shadow-card sm:p-8">
        {stepId === 'land' ? <LandStep {...stepProps} /> : null}
        {stepId === 'house' ? <HouseStep {...stepProps} /> : null}
        {stepId === 'rooms' ? <RoomsStep {...stepProps} /> : null}
        {stepId === 'features' ? <FeaturesStep {...stepProps} /> : null}
        {stepId === 'style' ? <StyleStep {...stepProps} /> : null}
        {stepId === 'review' && liveValidation ? (
          <ReviewStep {...stepProps} validation={liveValidation} onEditStep={goToStep} />
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={stepIndex === 0 || saveState === 'saving'}
          onClick={() => goToStep(Math.max(0, stepIndex - 1))}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('back')}
        </Button>

        <Button
          variant="accent"
          loading={saveState === 'saving'}
          disabled={archived}
          onClick={() => void handleNext()}
        >
          {isLastStep ? t('finish') : t('next')}
          {isLastStep ? null : <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
