'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Lightbulb, RotateCcw, Sparkles, SquarePen, TriangleAlert, Wand2 } from 'lucide-react';
import { createProjectSchema, type AiParseProjectResponse } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  blocksToDrop,
  readAssumption,
  readDomainValidationError,
  type ProposalBlock,
} from '@/lib/ai-proposal';
import { cn } from '@/lib/cn';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';
import { ValidationPanel } from '../validation-panel';
import { ProposalSummary } from './proposal-summary';

/** Create straight into the workspace, or create and continue in the wizard. */
export type ApplyIntent = 'create' | 'edit';

export interface ApplyValues {
  name: string;
  description: string | null;
  intent: ApplyIntent;
}

export interface AiProposalReviewProps {
  result: AiParseProjectResponse;
  /** Which action is currently running, if any. */
  pendingIntent: ApplyIntent | null;
  applyError: unknown;
  /** Set once the project exists — the apply then only has the config left to do. */
  createdProjectId: string | null;
  onApply: (values: ApplyValues) => void;
  onReset: () => void;
}

type FieldErrors = { name?: string; description?: string };

export function AiProposalReview({
  result,
  pendingIntent,
  applyError,
  createdProjectId,
  onApply,
  onReset,
}: AiProposalReviewProps) {
  const t = useTranslations('ai.review');
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();

  const { proposal, validation, provenance } = result;
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [name, setName] = useState(() => proposal.name ?? t('nameFallback'));
  const [description, setDescription] = useState(() => proposal.description ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  // The panel replaces the form, so the reading position has to follow it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const dropped = useMemo(() => blocksToDrop(proposal, validation), [proposal, validation]);
  const blockLabels: Record<ProposalBlock, string> = {
    land: t('blocks.land'),
    house: t('blocks.house'),
    rooms: t('blocks.rooms'),
  };
  const droppedLabels = [...dropped].map((block) => blockLabels[block]).join(', ');

  const languages = {
    uz: t('languages.uz'),
    ru: t('languages.ru'),
    en: t('languages.en'),
    other: t('languages.other'),
  };

  const assumptions = proposal.assumptions.map(readAssumption);
  const applyValidation = readDomainValidationError(applyError);
  const busy = pendingIntent !== null;

  function submit(intent: ApplyIntent) {
    const trimmedDescription = description.trim();
    const parsed = createProjectSchema.safeParse({
      name,
      description: trimmedDescription === '' ? null : trimmedDescription,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name' && next.name === undefined) next.name = issue.message;
        if (key === 'description' && next.description === undefined) next.description = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    onApply({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      intent,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-md border border-line bg-surface p-6 shadow-card sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            {t('title')}
          </h2>
          <span className="rounded-sm bg-paper px-2 py-1 text-xs font-semibold text-ink-faint">
            {t('detectedLanguage', { language: languages[proposal.detectedLanguage] })}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('subtitle')}</p>

        <div className="mt-6 flex flex-col gap-5">
          <Field label={t('nameLabel')} error={fieldError(errors.name)} required>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('nameFallback')}
              />
            )}
          </Field>

          <Field
            label={t('descriptionLabel')}
            error={fieldError(errors.description)}
            hint={t('descriptionHint')}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            )}
          </Field>
        </div>
      </header>

      <ValidationPanel errors={validation.errors} warnings={validation.warnings} showValid />

      <ProposalSummary proposal={proposal} />

      {assumptions.length > 0 ? (
        <section className="rounded-md border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-ink uppercase">
            <Lightbulb className="size-4 text-ink-faint" aria-hidden="true" />
            {t('assumptionsTitle')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">{t('assumptionsBody')}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {assumptions.map((assumption, index) => (
              <li
                key={`${index}-${assumption.text}`}
                className={cn(
                  'text-sm leading-relaxed',
                  assumption.fromServer
                    ? 'border-l-2 border-line-strong border-dashed pl-3 text-ink-faint'
                    : 'flex gap-2 text-ink',
                )}
              >
                {assumption.fromServer ? (
                  <span className="font-semibold text-ink-soft">{t('assumptionsServerIntro')} </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1 shrink-0 rounded-full bg-line-strong"
                  />
                )}
                {assumption.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {proposal.unmappable.length > 0 ? (
        <section
          aria-label={t('unmappableTitle')}
          className="rounded-md border border-warning/30 bg-warning-soft px-5 py-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-warning">
            <TriangleAlert className="size-4" aria-hidden="true" />
            {t('unmappableTitle')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t('unmappableBody')}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {proposal.unmappable.map((item, index) => (
              <li key={`${index}-${item}`} className="flex gap-2 text-sm leading-relaxed text-ink">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-warning" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {applyValidation !== null ? (
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-danger">{t('applyRejected')}</p>
          <ValidationPanel errors={applyValidation.errors} warnings={applyValidation.warnings} />
        </div>
      ) : applyError != null ? (
        <Alert tone="danger" title={t('applyFailed')} live>
          <p>{apiErrorMessage(applyError)}</p>
        </Alert>
      ) : null}

      {createdProjectId !== null && applyError != null ? (
        <Alert tone="info" title={t('createdTitle')}>
          <p>{t('createdBody')}</p>
          <Link
            href={`/projects/${createdProjectId}`}
            className={buttonClasses('outline', 'sm', 'mt-3')}
          >
            {t('createdOpen')}
          </Link>
        </Alert>
      ) : null}

      <footer className="rounded-md border border-line bg-surface p-5">
        {validation.valid ? (
          <p className="text-sm leading-relaxed text-ink-soft">{t('applyHint')}</p>
        ) : (
          <p id="ai-apply-blocked" className="text-sm leading-relaxed text-ink-soft">
            {t('applyBlocked')}
            {dropped.size > 0 ? ` ${t('applyDropped', { blocks: droppedLabels })}` : ''}
          </p>
        )}

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" onClick={onReset} disabled={busy}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('reset')}
          </Button>

          <Button
            variant={validation.valid ? 'outline' : 'accent'}
            onClick={() => submit('edit')}
            loading={pendingIntent === 'edit'}
            disabled={busy}
          >
            <SquarePen className="size-4" aria-hidden="true" />
            {t('openInWizard')}
          </Button>

          <Button
            variant="accent"
            onClick={() => submit('create')}
            loading={pendingIntent === 'create'}
            disabled={busy || !validation.valid}
            title={validation.valid ? undefined : t('applyBlocked')}
            aria-describedby={validation.valid ? undefined : 'ai-apply-blocked'}
          >
            <Wand2 className="size-4" aria-hidden="true" />
            {pendingIntent === 'create' ? t('applying') : t('apply')}
          </Button>
        </div>

        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-faint">
          {t('provenance', { model: provenance.model, version: provenance.promptVersion })}
        </p>
      </footer>
    </div>
  );
}
