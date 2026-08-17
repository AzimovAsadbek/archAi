'use client';

import { useTranslations } from 'next-intl';
import { StyleSelector } from '../style-selector';
import { StepShell, type StepProps } from './step-shell';

export function StyleStep({ draft, update, disabled }: StepProps) {
  const t = useTranslations('wizard.style');

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      {/* Drawn elevations rather than text cards: a facade is a visual choice
          and reads faster as a picture than as a paragraph. */}
      <StyleSelector
        label={t('title')}
        value={draft.style}
        disabled={disabled}
        onChange={(style) => update({ style })}
      />
      <p className="mt-4 text-xs leading-relaxed text-ink-faint">{t('note')}</p>
    </StepShell>
  );
}
