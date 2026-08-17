'use client';

import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/choice';
import { FEATURE_ICONS, FEATURE_KEYS } from '@/lib/project-options';
import { StepShell, type StepProps } from './step-shell';

export function FeaturesStep({ draft, update, disabled }: StepProps) {
  const t = useTranslations('wizard.features');
  const tFeatures = useTranslations('features');

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      {/* Switches rather than toggle cards: each one takes effect on the draft
          immediately, which is what `role="switch"` announces — a checkbox
          would imply the change waits for a submit. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {FEATURE_KEYS.map((feature) => {
          const Icon = FEATURE_ICONS[feature];
          const checked = draft.features[feature];
          return (
            <div
              key={feature}
              className={`flex items-start gap-3 rounded-panel border p-4 transition-colors ${
                checked ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border ${
                  checked
                    ? 'border-accent/30 bg-surface text-accent-strong'
                    : 'border-line bg-paper text-ink-faint'
                }`}
              >
                <Icon className="size-4" />
              </span>
              <Switch
                className="flex-1"
                checked={checked}
                disabled={disabled}
                label={tFeatures(`${feature}.label`)}
                hint={tFeatures(`${feature}.description`)}
                onChange={(event) =>
                  update({
                    features: { ...draft.features, [feature]: event.target.checked },
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </StepShell>
  );
}
