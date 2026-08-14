import { useTranslations } from 'next-intl';

/**
 * Abstract floor-plan diagram built from borders only — no images, no gradients.
 * Purely decorative apart from the labels, which stay localized.
 */
export function HeroSchematic() {
  const t = useTranslations('marketing.schematic');

  const rooms: Array<{ key: string; label: string; className: string; area: string }> = [
    { key: 'living', label: t('living'), className: 'col-span-3 row-span-2', area: '6.0 × 5.0' },
    { key: 'kitchen', label: t('kitchen'), className: 'col-span-2 row-span-1', area: '4.0 × 2.5' },
    { key: 'dining', label: t('dining'), className: 'col-span-2 row-span-1', area: '4.0 × 2.5' },
    { key: 'bedroom', label: t('bedroom'), className: 'col-span-2 row-span-2', area: '4.0 × 5.0' },
    { key: 'bath', label: t('bath'), className: 'col-span-1 row-span-1', area: '2.0 × 2.5' },
    { key: 'hallway', label: t('hallway'), className: 'col-span-2 row-span-1', area: '4.0 × 2.5' },
  ];

  return (
    <figure className="w-full">
      <div className="rounded-md border border-line bg-surface p-4 shadow-card sm:p-6">
        {/* Land plot */}
        <div className="relative rounded-sm border border-dashed border-line-strong bg-paper p-4 sm:p-6">
          <span className="absolute -top-2.5 left-4 bg-surface px-1.5 text-[10px] font-bold tracking-widest text-ink-faint uppercase">
            {t('plot')}
          </span>

          {/* House footprint */}
          <div className="grid grid-cols-5 grid-rows-4 gap-1 border-2 border-ink bg-ink/5 p-1">
            {rooms.map((room) => (
              <div
                key={room.key}
                className={`flex min-h-14 flex-col justify-end border border-line-strong bg-surface p-1.5 sm:min-h-16 ${room.className}`}
              >
                <span className="truncate text-[10px] leading-tight font-bold text-ink sm:text-[11px]">
                  {room.label}
                </span>
                <span className="numeric truncate text-[9px] leading-tight text-ink-faint sm:text-[10px]">
                  {room.area}
                </span>
              </div>
            ))}
          </div>

          {/* Horizontal dimension line */}
          <div className="mt-4 flex items-center gap-2" aria-hidden="true">
            <span className="h-2 w-px bg-line-strong" />
            <span className="h-px flex-1 bg-line-strong" />
            <span className="numeric text-[10px] font-semibold text-ink-faint">12.0 m</span>
            <span className="h-px flex-1 bg-line-strong" />
            <span className="h-2 w-px bg-line-strong" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="numeric text-xs font-semibold text-ink-soft">{t('caption')}</span>
          <span className="text-[10px] font-bold tracking-widest text-ink-faint uppercase">
            {t('title')}
          </span>
        </div>
      </div>
      <figcaption className="sr-only">{t('description')}</figcaption>
    </figure>
  );
}
