'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Lightbulb, MessagesSquare, Send, Sparkles } from 'lucide-react';
import { type AiSuggestionPriority } from '@archai/shared';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import {
  AI_FOCUS_MAX,
  AI_QUESTION_LIMITS,
  askProjectQuestion,
  suggestImprovements,
} from '@/lib/endpoints';
import { AiErrorPanel } from './ai/ai-error-panel';

const PRIORITY_TONE: Record<AiSuggestionPriority, BadgeTone> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'faint',
};

type Locale = 'uz' | 'ru' | 'en';

/**
 * The AI assistant for an existing project: advisory design suggestions and a
 * grounded Q&A. Both are on-demand (a click, never a background poll — free-tier
 * budget), and both degrade honestly through {@link AiErrorPanel} when AI is not
 * configured or the provider is unavailable. Nothing here mutates the project.
 */
export function AssistantPanel({ projectId }: { projectId: string }) {
  const t = useTranslations('workspace.assistant');
  const tCategories = useTranslations('workspace.assistant.categories');
  const tPriorities = useTranslations('workspace.assistant.priorities');
  const locale = useLocale() as Locale;

  const [focus, setFocus] = useState('');
  const [question, setQuestion] = useState('');

  const suggest = useMutation({
    mutationFn: () =>
      suggestImprovements(projectId, {
        focus: focus.trim().length > 0 ? focus.trim() : undefined,
        localeHint: locale,
      }),
  });

  const ask = useMutation({
    mutationFn: (q: string) => askProjectQuestion(projectId, { question: q, localeHint: locale }),
  });

  const trimmedQuestion = question.trim();
  const canAsk =
    trimmedQuestion.length >= AI_QUESTION_LIMITS.min &&
    trimmedQuestion.length <= AI_QUESTION_LIMITS.max;

  const result = suggest.data?.suggestions;
  const answer = ask.data?.answer;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Suggestions ─────────────────────────────────────────────── */}
      <section
        aria-labelledby="assistant-suggest-heading"
        className="rounded-panel border border-line bg-surface p-5"
      >
        <header className="flex items-start gap-3">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong"
            aria-hidden="true"
          >
            <Lightbulb className="size-5" />
          </span>
          <div>
            <h2 id="assistant-suggest-heading" className="text-sm font-bold text-ink">
              {t('suggest.title')}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{t('suggest.description')}</p>
          </div>
        </header>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-semibold text-ink-faint">{t('suggest.focusLabel')}</span>
            <Input
              value={focus}
              maxLength={AI_FOCUS_MAX}
              placeholder={t('suggest.focusPlaceholder')}
              disabled={suggest.isPending}
              onChange={(event) => setFocus(event.target.value)}
            />
          </label>
          <Button onClick={() => suggest.mutate()} loading={suggest.isPending}>
            <Sparkles className="size-4" aria-hidden="true" />
            {t('suggest.action')}
          </Button>
        </div>

        <div className="mt-4" aria-live="polite">
          {suggest.isError ? (
            <AiErrorPanel
              error={suggest.error}
              onRetry={() => suggest.mutate()}
              pending={suggest.isPending}
            />
          ) : result ? (
            <div className="flex flex-col gap-3">
              {result.summary ? (
                <p className="text-sm font-medium text-ink">{result.summary}</p>
              ) : null}
              {result.suggestions.length === 0 ? (
                <p className="text-sm text-ink-soft">{t('suggest.none')}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index} className="rounded-panel border border-line bg-paper p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="faint" size="sm">
                          {tCategories(suggestion.category)}
                        </Badge>
                        <Badge tone={PRIORITY_TONE[suggestion.priority]} size="sm">
                          {tPriorities(suggestion.priority)}
                        </Badge>
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-ink">{suggestion.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                        {suggestion.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-faint">{t('suggest.idle')}</p>
          )}
        </div>
      </section>

      {/* ── Ask a question ──────────────────────────────────────────── */}
      <section
        aria-labelledby="assistant-ask-heading"
        className="rounded-panel border border-line bg-surface p-5"
      >
        <header className="flex items-start gap-3">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong"
            aria-hidden="true"
          >
            <MessagesSquare className="size-5" />
          </span>
          <div>
            <h2 id="assistant-ask-heading" className="text-sm font-bold text-ink">
              {t('ask.title')}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{t('ask.description')}</p>
          </div>
        </header>

        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canAsk) ask.mutate(trimmedQuestion);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-faint">{t('ask.label')}</span>
            <Textarea
              value={question}
              rows={3}
              maxLength={AI_QUESTION_LIMITS.max}
              placeholder={t('ask.placeholder')}
              disabled={ask.isPending}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" loading={ask.isPending} disabled={!canAsk}>
              <Send className="size-4" aria-hidden="true" />
              {t('ask.action')}
            </Button>
          </div>
        </form>

        <div className="mt-1" aria-live="polite">
          {ask.isError ? (
            <AiErrorPanel
              error={ask.error}
              onRetry={canAsk ? () => ask.mutate(trimmedQuestion) : undefined}
              pending={ask.isPending}
            />
          ) : answer ? (
            <div
              className={cn(
                'rounded-md border p-4 text-sm leading-relaxed',
                answer.addressable
                  ? 'border-line bg-paper text-ink-soft'
                  : 'border-warning/40 bg-warning-soft text-ink-soft',
              )}
            >
              <p className="whitespace-pre-wrap">{answer.answer}</p>
              {!answer.addressable ? (
                <p className="mt-2 text-xs font-semibold text-warning">{t('ask.outOfScope')}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <p className="text-xs text-ink-faint">{t('disclaimer')}</p>
    </div>
  );
}
