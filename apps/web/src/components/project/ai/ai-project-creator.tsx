'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Sparkles } from 'lucide-react';
import { type AiParseProjectResponse, type UpdateProjectInput } from '@archai/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import {
  blocksToDrop,
  isEmptyPatch,
  proposalToUpdateInput,
  type ProposalBlock,
} from '@/lib/ai-proposal';
import { cn } from '@/lib/cn';
import {
  AI_TEXT_LIMITS,
  createProject,
  parseProjectRequest,
  updateProject,
} from '@/lib/endpoints';
import { resolveLocale } from '@/i18n/locales';
import { queryKeys } from '@/lib/query-keys';
import { readApiFieldIssues, useFieldError } from '@/lib/zod-errors';
import { AiErrorPanel } from './ai-error-panel';
import { AiProposalReview, type ApplyIntent, type ApplyValues } from './ai-proposal-review';

/** Mirrors the server schema so the obvious mistakes never cost a round trip. */
const requestTextSchema = z
  .string()
  .trim()
  .min(AI_TEXT_LIMITS.min, 'ai_text_min')
  .max(AI_TEXT_LIMITS.max, 'ai_text_max');

interface ApplyResult {
  projectId: string;
  intent: ApplyIntent;
}

export function AiProjectCreator({ onUseSimple }: { onUseSimple: () => void }) {
  const t = useTranslations('ai.input');
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldError = useFieldError();
  const locale = resolveLocale(useLocale());

  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | undefined>();
  const [result, setResult] = useState<AiParseProjectResponse | null>(null);
  const [pendingIntent, setPendingIntent] = useState<ApplyIntent | null>(null);
  /** Kept across retries so a failed configuration patch never creates a second project. */
  const createdProjectId = useRef<string | null>(null);
  const [createdVisible, setCreatedVisible] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // Discarding the proposal unmounts it — put the caret back where work resumes.
  useEffect(() => {
    if (focusRequest > 0 && result === null) textareaRef.current?.focus();
  }, [focusRequest, result]);

  const parseMutation = useMutation({
    mutationFn: (value: string) => parseProjectRequest({ text: value, localeHint: locale }),
    onSuccess: (data) => {
      createdProjectId.current = null;
      setCreatedVisible(null);
      setResult(data);
    },
  });

  const applyMutation = useMutation({
    mutationFn: async ({ name, description, intent }: ApplyValues): Promise<ApplyResult> => {
      if (result === null) throw new Error('No proposal to apply');

      // A retry after a failed PATCH reuses the project the first attempt made.
      let projectId = createdProjectId.current;
      const patch = buildPatch(result, intent);

      if (projectId === null) {
        const project = await createProject({ name, description });
        projectId = project.id;
        createdProjectId.current = project.id;
        setCreatedVisible(project.id);
        queryClient.setQueryData(queryKeys.project(project.id), project);
      } else {
        patch.name = name;
        patch.description = description;
      }

      if (!isEmptyPatch(patch)) {
        const updated = await updateProject(projectId, patch);
        queryClient.setQueryData(queryKeys.project(projectId), updated);
      }

      return { projectId, intent };
    },
    onSettled: () => setPendingIntent(null),
    onSuccess: ({ projectId, intent }) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push(intent === 'edit' ? `/projects/${projectId}/edit` : `/projects/${projectId}`);
    },
  });

  const serverTextError = useMemo(
    () => readApiFieldIssues(parseMutation.error).find((issue) => issue.path === 'text')?.message,
    [parseMutation.error],
  );
  const shownTextError = fieldError(textError ?? serverTextError);
  const showErrorPanel = parseMutation.isError && serverTextError === undefined;

  function submit(): void {
    const parsed = requestTextSchema.safeParse(text);
    if (!parsed.success) {
      setTextError(parsed.error.issues[0]?.message ?? 'invalid');
      return;
    }
    setTextError(undefined);
    parseMutation.mutate(parsed.data);
  }

  function reset(): void {
    createdProjectId.current = null;
    setCreatedVisible(null);
    setResult(null);
    applyMutation.reset();
    parseMutation.reset();
    setFocusRequest((value) => value + 1);
  }

  function apply(values: ApplyValues): void {
    setPendingIntent(values.intent);
    applyMutation.mutate(values);
  }

  const liveMessage = parseMutation.isPending
    ? t('pendingLive')
    : result !== null
      ? t('readyLive')
      : '';

  return (
    <div className="flex flex-col gap-5">
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {result === null ? (
        <div className="rounded-md border border-line bg-surface p-6 shadow-card sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            {t('title')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('subtitle')}</p>

          <form
            noValidate
            className="mt-6 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Field
              label={t('label')}
              error={shownTextError}
              hint={t('hint')}
              labelSuffix={
                <span
                  className={cn(
                    'numeric text-xs',
                    text.trim().length > AI_TEXT_LIMITS.max ? 'text-danger' : 'text-ink-faint',
                  )}
                >
                  <span className="sr-only">{t('counterLabel')}: </span>
                  {t('counter', { count: text.trim().length, max: AI_TEXT_LIMITS.max })}
                </span>
              }
            >
              {(control) => (
                <Textarea
                  {...control}
                  ref={textareaRef}
                  rows={6}
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    // The bounds message stops applying the moment they type.
                    if (textError !== undefined) setTextError(undefined);
                  }}
                  placeholder={t('placeholder')}
                  disabled={parseMutation.isPending}
                />
              )}
            </Field>

            <p className="rounded-sm border border-line border-dashed bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">{t('exampleLabel')}: </span>
              {t('example')}
            </p>

            {showErrorPanel ? (
              <AiErrorPanel
                error={parseMutation.error}
                onRetry={submit}
                onUseSimple={onUseSimple}
                pending={parseMutation.isPending}
              />
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-ink-faint">{t('note')}</p>
              <Button type="submit" variant="accent" loading={parseMutation.isPending}>
                <Sparkles className="size-4" aria-hidden="true" />
                {parseMutation.isPending ? t('pending') : t('submit')}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <AiProposalReview
          result={result}
          pendingIntent={pendingIntent}
          applyError={applyMutation.error}
          createdProjectId={createdVisible}
          onApply={apply}
          onReset={reset}
        />
      )}
    </div>
  );
}

/**
 * Proposal → PATCH body. A create keeps every proposed block (the endpoint has
 * already confirmed the configuration is valid); opening the wizard instead
 * drops exactly the blocks the domain errors blame, so the rest still lands.
 */
function buildPatch(result: AiParseProjectResponse, intent: ApplyIntent): UpdateProjectInput {
  const dropped: ReadonlySet<ProposalBlock> =
    intent === 'edit' ? blocksToDrop(result.proposal, result.validation) : new Set();
  return proposalToUpdateInput(result.proposal, dropped);
}
