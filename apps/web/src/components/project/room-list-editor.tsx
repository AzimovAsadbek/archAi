'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { LIMITS, ROOM_TYPES, type RoomType } from '@archai/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { nextRoomKey, roomAreaM2, usedFloorAreaM2, type DraftRoom } from '@/lib/draft-project';
import { QUICK_ROOM_TYPES } from '@/lib/project-options';

export interface RoomListEditorProps {
  rooms: DraftRoom[];
  floorCount: number;
  /** Single-floor plate area in m², when the house dimensions are known. */
  floorPlateM2: number | null;
  /**
   * Updater form so rapid successive edits (quick-add clicks) compose against
   * the latest state instead of a stale `rooms` prop snapshot.
   */
  onChange: (updater: (prev: DraftRoom[]) => DraftRoom[]) => void;
  disabled?: boolean;
  /** Localized errors keyed by `rooms.<index>.<field>`. */
  errors?: Record<string, string | undefined>;
}

const OTHER_ROOM_TYPES = ROOM_TYPES.filter(
  (type) => !(QUICK_ROOM_TYPES as readonly RoomType[]).includes(type),
);

export function RoomListEditor({
  rooms,
  floorCount,
  floorPlateM2,
  onChange,
  disabled = false,
  errors,
}: RoomListEditorProps) {
  const t = useTranslations('wizard.rooms');
  const tRoomTypes = useTranslations('roomTypes');
  const [otherType, setOtherType] = useState<RoomType | ''>('');

  const atLimit = rooms.length >= LIMITS.rooms.maxPerProject;

  const addRoom = (type: RoomType) => {
    onChange((prev) =>
      prev.length >= LIMITS.rooms.maxPerProject
        ? prev
        : [...prev, { key: nextRoomKey(), type, floor: 0, widthM: '', lengthM: '', label: '' }],
    );
  };

  const updateRoom = (key: string, patch: Partial<DraftRoom>) => {
    onChange((prev) => prev.map((room) => (room.key === key ? { ...room, ...patch } : room)));
  };

  const removeRoom = (key: string) => {
    onChange((prev) => prev.filter((room) => room.key !== key));
  };

  const floors = Array.from({ length: floorCount }, (_, index) => index);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold text-ink">{t('quickAdd')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {QUICK_ROOM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              disabled={disabled || atLimit}
              onClick={() => addRoom(type)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {tRoomTypes(type)}
            </button>
          ))}

          <span className="flex items-center gap-2">
            <Select
              label={t('otherType')}
              value={otherType}
              disabled={disabled || atLimit}
              onChange={(next) => setOtherType(next as RoomType | '')}
              className="w-44"
              options={[
                { value: '', label: t('otherType') },
                ...OTHER_ROOM_TYPES.map((type) => ({ value: type, label: tRoomTypes(type) })),
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || atLimit || otherType === ''}
              onClick={() => {
                if (otherType === '') return;
                addRoom(otherType);
                setOtherType('');
              }}
            >
              {t('add')}
            </Button>
          </span>
        </div>
        {atLimit ? (
          <p className="mt-2 text-xs font-medium text-warning">
            {t('limit', { max: LIMITS.rooms.maxPerProject })}
          </p>
        ) : null}
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong bg-paper px-4 py-8 text-center text-sm text-ink-soft">
          {t('empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {floors.map((floor) => {
            const floorRooms = rooms.filter((room) => room.floor === floor);
            const used = usedFloorAreaM2(rooms, floor);
            const over = floorPlateM2 !== null && used > floorPlateM2;

            return (
              <section key={floor} className="rounded-md border border-line bg-surface">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <h3 className="text-sm font-bold text-ink">
                    {t('floorGroup', { floor: floor + 1 })}
                  </h3>
                  {floorPlateM2 !== null ? (
                    <p
                      className={cn(
                        'numeric text-xs font-semibold',
                        over ? 'text-danger' : 'text-ink-faint',
                      )}
                    >
                      {t('floorUsage', { used, total: floorPlateM2 })}
                    </p>
                  ) : null}
                </header>

                {floorRooms.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-ink-faint">{t('floorEmpty')}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {floorRooms.map((room) => {
                      const area = roomAreaM2(room);
                      const index = rooms.indexOf(room);
                      const widthError = errors?.[`rooms.${index}.widthM`];
                      const lengthError = errors?.[`rooms.${index}.lengthM`];
                      return (
                        <li
                          key={room.key}
                          className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end"
                        >
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-ink-faint">
                              {t('type')}
                            </span>
                            <Select
                              label={t('type')}
                              value={room.type}
                              disabled={disabled}
                              onChange={(next) =>
                                updateRoom(room.key, { type: next as RoomType })
                              }
                              options={ROOM_TYPES.map((type) => ({
                                value: type,
                                label: tRoomTypes(type),
                              }))}
                            />
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-ink-faint">
                              {t('floor')}
                            </span>
                            <Select
                              label={t('floor')}
                              value={room.floor}
                              disabled={disabled}
                              onChange={(next) =>
                                updateRoom(room.key, { floor: Number(next) })
                              }
                              options={floors.map((value) => ({
                                value,
                                label: t('floorOption', { floor: value + 1 }),
                              }))}
                            />
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-ink-faint">
                              {t('width')}
                            </span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min={LIMITS.rooms.minSideM}
                              max={LIMITS.rooms.maxSideM}
                              value={room.widthM}
                              disabled={disabled}
                              invalid={Boolean(widthError)}
                              onChange={(event) =>
                                updateRoom(room.key, { widthM: event.target.value })
                              }
                              className="h-9 text-sm"
                            />
                            {widthError ? (
                              <span role="alert" className="text-xs font-medium text-danger">
                                {widthError}
                              </span>
                            ) : null}
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-ink-faint">
                              {t('length')}
                            </span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min={LIMITS.rooms.minSideM}
                              max={LIMITS.rooms.maxSideM}
                              value={room.lengthM}
                              disabled={disabled}
                              invalid={Boolean(lengthError)}
                              onChange={(event) =>
                                updateRoom(room.key, { lengthM: event.target.value })
                              }
                              className="h-9 text-sm"
                            />
                            {lengthError ? (
                              <span role="alert" className="text-xs font-medium text-danger">
                                {lengthError}
                              </span>
                            ) : null}
                          </label>

                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <span className="numeric text-sm font-semibold text-ink-soft">
                              {area === null ? '—' : t('areaValue', { area })}
                            </span>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => removeRoom(room.key)}
                              aria-label={t('remove', { type: tRoomTypes(room.type) })}
                              className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-line text-ink-faint transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
