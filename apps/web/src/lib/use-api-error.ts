'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from './api';

/** Maps an ApiError `code` to a localized sentence, falling back to a generic one. */
export function useApiErrorMessage(): (error: unknown) => string | undefined {
  const t = useTranslations('apiErrors');

  return useCallback(
    (error: unknown) => {
      if (error === null || error === undefined) return undefined;
      if (!(error instanceof ApiError)) return t('generic');
      return t.has(error.code) ? t(error.code) : t('generic');
    },
    [t],
  );
}
