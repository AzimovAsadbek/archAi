'use client';

import { useTranslations } from 'next-intl';
import { parseNumberInput, round } from '@/lib/format';
import { RoomListEditor } from '../room-list-editor';
import { StepShell, type StepProps } from './step-shell';

export function RoomsStep({ draft, update, errors, disabled }: StepProps) {
  const t = useTranslations('wizard.rooms');

  const width = parseNumberInput(draft.houseWidth);
  const length = parseNumberInput(draft.houseLength);
  const floorPlateM2 = width !== null && length !== null ? round(width * length, 1) : null;

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      <RoomListEditor
        rooms={draft.rooms}
        floorCount={draft.floorCount}
        floorPlateM2={floorPlateM2}
        disabled={disabled}
        errors={errors}
        onChange={(updater) => update((current) => ({ rooms: updater(current.rooms) }))}
      />
    </StepShell>
  );
}
