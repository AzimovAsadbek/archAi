'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { type ProjectProposal } from '@archai/shared';
import { coveragePercent, m2ToSotix, round } from '@/lib/format';
import { cn } from '@/lib/cn';
import { FEATURE_ICONS, FEATURE_KEYS } from '@/lib/project-options';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="numeric text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h3 className="border-b border-line pb-3 text-sm font-bold tracking-wide text-ink uppercase">
        {title}
      </h3>
      <div className="pt-3">{children}</div>
    </section>
  );
}

const CHIP = 'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-semibold';

/** Floors that actually carry rooms, ascending — a proposal may have rooms without a house. */
function occupiedFloors(proposal: ProjectProposal): number[] {
  return [...new Set(proposal.rooms.map((room) => room.floor))].sort((a, b) => a - b);
}

export function ProposalSummary({ proposal }: { proposal: ProjectProposal }) {
  const t = useTranslations('ai.review');
  const tRoomTypes = useTranslations('roomTypes');
  const tStyles = useTranslations('styles');
  const tFeatures = useTranslations('features');
  const tStrategies = useTranslations('strategies');

  const { land, house, rooms } = proposal;
  const notSet = t('notSet');
  const footprint = house === null ? null : round(house.widthM * house.lengthM, 1);
  const totalArea = footprint === null || house === null ? null : round(footprint * house.floorCount, 1);
  const coverage =
    footprint === null || land === null ? null : coveragePercent(footprint, land.areaM2);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title={t('landTitle')}>
          <dl className="divide-y divide-line">
            <SummaryRow
              label={t('landArea')}
              value={
                land === null
                  ? notSet
                  : t('landAreaValue', { m2: land.areaM2, sotix: m2ToSotix(land.areaM2) })
              }
            />
            <SummaryRow
              label={t('landDims')}
              value={
                land?.widthM != null && land.lengthM != null
                  ? t('dimsValue', { width: land.widthM, length: land.lengthM })
                  : notSet
              }
            />
          </dl>
        </SummaryCard>

        <SummaryCard title={t('houseTitle')}>
          <dl className="divide-y divide-line">
            <SummaryRow
              label={t('houseDims')}
              value={
                house === null
                  ? notSet
                  : t('dimsValue', { width: house.widthM, length: house.lengthM })
              }
            />
            <SummaryRow
              label={t('floors')}
              value={house === null ? notSet : t('floorsValue', { count: house.floorCount })}
            />
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

      <SummaryCard title={t('roomsTitle')}>
        {rooms.length === 0 ? (
          <p className="text-sm text-ink-faint">{t('roomsEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {occupiedFloors(proposal).map((floor) => {
              const floorRooms = rooms.filter((room) => room.floor === floor);
              return (
                <div key={floor}>
                  <h4 className="text-xs font-bold tracking-wide text-ink-faint uppercase">
                    {t('floorGroup', { floor: floor + 1 })}
                  </h4>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {floorRooms.map((room, index) => {
                      const area =
                        room.widthM != null && room.lengthM != null
                          ? round(room.widthM * room.lengthM, 1)
                          : null;
                      const label =
                        room.label !== null && room.label.trim() !== ''
                          ? room.label.trim()
                          : tRoomTypes(room.type);
                      return (
                        <li
                          key={`${floor}-${index}`}
                          className={cn(CHIP, 'numeric border-line bg-paper font-medium text-ink')}
                        >
                          {label}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title={t('featuresTitle')}>
          <ul className="flex flex-wrap gap-2">
            {FEATURE_KEYS.map((feature) => {
              const Icon = FEATURE_ICONS[feature];
              const value = proposal.features[feature];
              return (
                <li
                  key={feature}
                  className={cn(
                    CHIP,
                    value === true && 'border-line bg-paper text-ink',
                    value === false && 'border-line bg-paper text-ink-faint line-through',
                    value === null && 'border-dashed border-line bg-transparent text-ink-faint',
                  )}
                >
                  <Icon
                    className={cn('size-3.5', value === true ? 'text-ink-faint' : 'text-line-strong')}
                    aria-hidden="true"
                  />
                  {tFeatures(`${feature}.label`)}
                  {value === false ? (
                    <span className="font-medium no-underline">· {t('featureNo')}</span>
                  ) : null}
                  {value === null ? (
                    <span className="font-medium">· {t('featureUnknown')}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </SummaryCard>

        <SummaryCard title={t('styleTitle')}>
          {house?.style == null ? (
            <p className="text-sm text-ink-faint">{t('styleEmpty')}</p>
          ) : (
            <div>
              <p className="text-sm font-bold text-ink">{tStyles(`${house.style}.label`)}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {tStyles(`${house.style}.description`)}
              </p>
            </div>
          )}
        </SummaryCard>

        <SummaryCard title={t('strategyTitle')}>
          {proposal.layoutStrategy === null ? (
            <p className="text-sm text-ink-faint">{t('strategyEmpty')}</p>
          ) : (
            <div>
              <p className="text-sm font-bold text-ink">
                {tStrategies(`${proposal.layoutStrategy}.label`)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {tStrategies(`${proposal.layoutStrategy}.description`)}
              </p>
            </div>
          )}
        </SummaryCard>
      </div>
    </div>
  );
}
