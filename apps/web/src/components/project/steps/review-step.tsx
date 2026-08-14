'use client';

import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import { type DomainValidationResult } from '@archai/shared';
import { draftLandAreaM2, roomAreaM2, usedFloorAreaM2 } from '@/lib/draft-project';
import { coveragePercent, m2ToSotix, parseNumberInput, round } from '@/lib/format';
import { FEATURE_ICONS, FEATURE_KEYS } from '@/lib/project-options';
import { ValidationPanel } from '../validation-panel';
import { StepShell, type StepProps } from './step-shell';

export interface ReviewStepProps extends StepProps {
  validation: DomainValidationResult;
  onEditStep: (index: number) => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="numeric text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SummaryCard({
  title,
  stepIndex,
  onEditStep,
  editLabel,
  children,
}: {
  title: string;
  stepIndex: number;
  onEditStep: (index: number) => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <header className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <h3 className="text-sm font-bold tracking-wide text-ink uppercase">{title}</h3>
        <button
          type="button"
          onClick={() => onEditStep(stepIndex)}
          className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-ink-faint transition-colors hover:text-accent"
        >
          <Pencil className="size-3" aria-hidden="true" />
          {editLabel}
        </button>
      </header>
      <div className="pt-3">{children}</div>
    </section>
  );
}

export function ReviewStep({ draft, validation, onEditStep }: ReviewStepProps) {
  const t = useTranslations('wizard.review');
  const tRoomTypes = useTranslations('roomTypes');
  const tStyles = useTranslations('styles');
  const tFeatures = useTranslations('features');

  const landAreaM2 = draftLandAreaM2(draft);
  const width = parseNumberInput(draft.houseWidth);
  const length = parseNumberInput(draft.houseLength);
  const footprint = width !== null && length !== null ? round(width * length, 1) : null;
  const totalArea = footprint !== null ? round(footprint * draft.floorCount, 1) : null;
  const coverage =
    footprint !== null && landAreaM2 !== null ? coveragePercent(footprint, landAreaM2) : null;
  const enabledFeatures = FEATURE_KEYS.filter((feature) => draft.features[feature]);
  const notSet = t('notSet');
  const editLabel = t('edit');

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      <div className="flex flex-col gap-4">
        <ValidationPanel
          errors={validation.errors}
          warnings={validation.warnings}
          showValid
          className="mb-1"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            title={t('landTitle')}
            stepIndex={0}
            onEditStep={onEditStep}
            editLabel={editLabel}
          >
            <dl className="divide-y divide-line">
              <SummaryRow
                label={t('landArea')}
                value={
                  landAreaM2 === null
                    ? notSet
                    : t('landAreaValue', { m2: landAreaM2, sotix: m2ToSotix(landAreaM2) })
                }
              />
              <SummaryRow
                label={t('landDims')}
                value={
                  draft.landWidth && draft.landLength
                    ? t('dimsValue', {
                        width: parseNumberInput(draft.landWidth) ?? 0,
                        length: parseNumberInput(draft.landLength) ?? 0,
                      })
                    : notSet
                }
              />
            </dl>
          </SummaryCard>

          <SummaryCard
            title={t('houseTitle')}
            stepIndex={1}
            onEditStep={onEditStep}
            editLabel={editLabel}
          >
            <dl className="divide-y divide-line">
              <SummaryRow
                label={t('houseDims')}
                value={
                  width !== null && length !== null ? t('dimsValue', { width, length }) : notSet
                }
              />
              <SummaryRow label={t('floors')} value={t('floorsValue', { count: draft.floorCount })} />
              <SummaryRow
                label={t('footprint')}
                value={footprint === null ? notSet : t('areaValue', { area: footprint })}
              />
              <SummaryRow
                label={t('totalArea')}
                value={totalArea === null ? notSet : t('areaValue', { area: totalArea })}
              />
              <SummaryRow
                label={t('coverage')}
                value={coverage === null ? notSet : t('coverageValue', { percent: coverage })}
              />
            </dl>
          </SummaryCard>
        </div>

        <SummaryCard
          title={t('roomsTitle')}
          stepIndex={2}
          onEditStep={onEditStep}
          editLabel={editLabel}
        >
          {draft.rooms.length === 0 ? (
            <p className="text-sm text-ink-faint">{t('roomsEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {Array.from({ length: draft.floorCount }, (_, floor) => floor).map((floor) => {
                const floorRooms = draft.rooms.filter((room) => room.floor === floor);
                if (floorRooms.length === 0) return null;
                return (
                  <div key={floor}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="text-xs font-bold tracking-wide text-ink-faint uppercase">
                        {t('floorGroup', { floor: floor + 1 })}
                      </h4>
                      <span className="numeric text-xs text-ink-faint">
                        {t('floorUsed', { used: usedFloorAreaM2(draft.rooms, floor) })}
                      </span>
                    </div>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {floorRooms.map((room) => {
                        const area = roomAreaM2(room);
                        return (
                          <li
                            key={room.key}
                            className="numeric rounded-sm border border-line bg-paper px-2 py-1 text-xs font-medium text-ink"
                          >
                            {room.label.trim() === '' ? tRoomTypes(room.type) : room.label.trim()}
                            {area === null ? '' : ` · ${t('areaValue', { area })}`}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </SummaryCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            title={t('featuresTitle')}
            stepIndex={3}
            onEditStep={onEditStep}
            editLabel={editLabel}
          >
            {enabledFeatures.length === 0 ? (
              <p className="text-sm text-ink-faint">{t('featuresEmpty')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {enabledFeatures.map((feature) => {
                  const Icon = FEATURE_ICONS[feature];
                  return (
                    <li
                      key={feature}
                      className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-paper px-2 py-1 text-xs font-semibold text-ink"
                    >
                      <Icon className="size-3.5 text-ink-faint" aria-hidden="true" />
                      {tFeatures(`${feature}.label`)}
                    </li>
                  );
                })}
              </ul>
            )}
          </SummaryCard>

          <SummaryCard
            title={t('styleTitle')}
            stepIndex={4}
            onEditStep={onEditStep}
            editLabel={editLabel}
          >
            {draft.style === null ? (
              <p className="text-sm text-ink-faint">{t('styleEmpty')}</p>
            ) : (
              <div>
                <p className="text-sm font-bold text-ink">{tStyles(`${draft.style}.label`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {tStyles(`${draft.style}.description`)}
                </p>
              </div>
            )}
          </SummaryCard>
        </div>
      </div>
    </StepShell>
  );
}
