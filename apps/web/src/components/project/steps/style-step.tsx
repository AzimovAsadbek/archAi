'use client';

import { useTranslations } from 'next-intl';
import { HOUSE_STYLES } from '@archai/shared';
import { StyleRadioCard } from '../style-radio-card';
import { StepShell, type StepProps } from './step-shell';

export function StyleStep({ draft, update, disabled }: StepProps) {
  const t = useTranslations('wizard.style');
  const tStyles = useTranslations('styles');

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      <div className="grid gap-3 sm:grid-cols-2">
        {HOUSE_STYLES.map((style) => (
          <StyleRadioCard
            key={style}
            name="house-style"
            style={style}
            label={tStyles(`${style}.label`)}
            description={tStyles(`${style}.description`)}
            checked={draft.style === style}
            disabled={disabled}
            onSelect={(value) => update({ style: value })}
          />
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-faint">{t('note')}</p>
    </StepShell>
  );
}
