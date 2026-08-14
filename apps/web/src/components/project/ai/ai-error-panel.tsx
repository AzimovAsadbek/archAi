'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import { Alert, type AlertTone } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

export interface AiErrorView {
  tone: AlertTone;
  title: string;
  body: string;
  /** Retrying the same request can plausibly succeed. */
  retryable: boolean;
  /** The server simply has no AI configured — an honest fact, not a failure. */
  notConfigured: boolean;
}

/**
 * One localized panel per contract code (docs/api.md → POST /ai/parse-project).
 * The keys are spelled out rather than interpolated so the message checker can
 * verify every branch.
 */
export function useAiErrorView(): (error: unknown) => AiErrorView {
  const t = useTranslations('ai.errors');

  return useCallback(
    (error: unknown): AiErrorView => {
      const code = error instanceof ApiError ? error.code : 'generic';

      switch (code) {
        case 'AI_NOT_CONFIGURED':
          return {
            tone: 'info',
            title: t('AI_NOT_CONFIGURED.title'),
            body: t('AI_NOT_CONFIGURED.body'),
            retryable: false,
            notConfigured: true,
          };
        // The AI provider's own limit and the endpoint throttler read the same
        // to a user: wait a moment, then retry.
        case 'AI_RATE_LIMITED':
        case 'RATE_LIMITED':
          return {
            tone: 'warning',
            title: t('AI_RATE_LIMITED.title'),
            body: t('AI_RATE_LIMITED.body'),
            retryable: true,
            notConfigured: false,
          };
        case 'AI_TIMEOUT':
          return {
            tone: 'danger',
            title: t('AI_TIMEOUT.title'),
            body: t('AI_TIMEOUT.body'),
            retryable: true,
            notConfigured: false,
          };
        case 'AI_PROVIDER_ERROR':
          return {
            tone: 'danger',
            title: t('AI_PROVIDER_ERROR.title'),
            body: t('AI_PROVIDER_ERROR.body'),
            retryable: true,
            notConfigured: false,
          };
        case 'AI_REFUSED':
          return {
            tone: 'warning',
            title: t('AI_REFUSED.title'),
            body: t('AI_REFUSED.body'),
            retryable: false,
            notConfigured: false,
          };
        case 'AI_INVALID_OUTPUT':
          return {
            tone: 'warning',
            title: t('AI_INVALID_OUTPUT.title'),
            body: t('AI_INVALID_OUTPUT.body'),
            retryable: true,
            notConfigured: false,
          };
        case 'VALIDATION_ERROR':
          return {
            tone: 'danger',
            title: t('VALIDATION_ERROR.title'),
            body: t('VALIDATION_ERROR.body'),
            retryable: false,
            notConfigured: false,
          };
        case 'NETWORK_ERROR':
          return {
            tone: 'danger',
            title: t('NETWORK_ERROR.title'),
            body: t('NETWORK_ERROR.body'),
            retryable: true,
            notConfigured: false,
          };
        case 'UNAUTHORIZED':
          return {
            tone: 'danger',
            title: t('UNAUTHORIZED.title'),
            body: t('UNAUTHORIZED.body'),
            retryable: false,
            notConfigured: false,
          };
        default:
          return {
            tone: 'danger',
            title: t('generic.title'),
            body: t('generic.body'),
            retryable: true,
            notConfigured: false,
          };
      }
    },
    [t],
  );
}

export interface AiErrorPanelProps {
  error: unknown;
  onRetry?: () => void;
  /** Offered when the server has no AI at all, so the user still has a way forward. */
  onUseSimple?: () => void;
  pending?: boolean;
}

export function AiErrorPanel({ error, onRetry, onUseSimple, pending }: AiErrorPanelProps) {
  const t = useTranslations('ai.errors');
  const toView = useAiErrorView();
  const view = toView(error);

  return (
    <Alert tone={view.tone} title={view.title} live={!view.notConfigured}>
      <p>{view.body}</p>
      {(view.retryable && onRetry) || (view.notConfigured && onUseSimple) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {view.retryable && onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry} loading={pending}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t('retry')}
            </Button>
          ) : null}
          {view.notConfigured && onUseSimple ? (
            <Button variant="outline" size="sm" onClick={onUseSimple}>
              {t('useSimple')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Alert>
  );
}
