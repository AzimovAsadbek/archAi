'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, PencilLine, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AiProjectCreator } from './ai/ai-project-creator';
import { NewProjectForm } from './new-project-form';

type CreateMode = 'simple' | 'ai';

interface ModeCardProps {
  mode: CreateMode;
  checked: boolean;
  onSelect: (mode: CreateMode) => void;
  icon: ReactNode;
  label: string;
  body: string;
  badge?: string;
  /** The AI path is the one we put forward — visually, never by presetting it. */
  promoted?: boolean;
}

function ModeCard({
  mode,
  checked,
  onSelect,
  icon,
  label,
  body,
  badge,
  promoted,
}: ModeCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        checked
          ? 'border-accent bg-accent-soft/50'
          : promoted
            ? 'border-accent/40 bg-accent-soft/20 hover:border-accent'
            : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <input
        type="radio"
        name="create-mode"
        value={mode}
        checked={checked}
        onChange={() => onSelect(mode)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-accent' : 'border-line-strong',
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-accent" /> : null}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
            {icon}
            {label}
          </span>
          {badge ? (
            <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-strong">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-soft">{body}</span>
      </span>
    </label>
  );
}

export function NewProjectView() {
  const t = useTranslations('projectNew');
  const tMode = useTranslations('ai.mode');
  const [mode, setMode] = useState<CreateMode>('simple');

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t('back')}
      </Link>

      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{tMode('pageSubtitle')}</p>

      <fieldset className="mt-6">
        <legend className="sr-only">{tMode('legend')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            mode="simple"
            checked={mode === 'simple'}
            onSelect={setMode}
            icon={<PencilLine className="size-4 text-ink-faint" aria-hidden="true" />}
            label={tMode('simple.label')}
            body={tMode('simple.body')}
          />
          <ModeCard
            mode="ai"
            checked={mode === 'ai'}
            onSelect={setMode}
            icon={<Sparkles className="size-4 text-accent" aria-hidden="true" />}
            label={tMode('ai.label')}
            body={tMode('ai.body')}
            badge={tMode('ai.badge')}
            promoted
          />
        </div>
      </fieldset>

      <div className="mt-6">
        {mode === 'simple' ? (
          <NewProjectForm />
        ) : (
          <AiProjectCreator onUseSimple={() => setMode('simple')} />
        )}
      </div>
    </div>
  );
}
