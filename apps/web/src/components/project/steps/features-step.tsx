'use client';

import { useTranslations } from 'next-intl';
import { FEATURE_KEYS } from '@/lib/project-options';
import { FeatureToggleCard } from '../feature-toggle-card';
import { StepShell, type StepProps } from './step-shell';

export function FeaturesStep({ draft, update, disabled }: StepProps) {
  const t = useTranslations('wizard.features');
  const tFeatures = useTranslations('features');

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURE_KEYS.map((feature) => (
          <FeatureToggleCard
            key={feature}
            feature={feature}
            label={tFeatures(`${feature}.label`)}
            description={tFeatures(`${feature}.description`)}
            checked={draft.features[feature]}
            disabled={disabled}
            onChange={(checked) =>
              update({ features: { ...draft.features, [feature]: checked } })
            }
          />
        ))}
      </div>
    </StepShell>
  );
}
