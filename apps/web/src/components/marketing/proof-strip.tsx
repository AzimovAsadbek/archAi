import {
  Languages,
  Ruler,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/**
 * The four-up strip under the hero.
 *
 * The reference puts customer counts here — 10 000+ clients, 25 000+ projects,
 * 99% satisfaction. archAI has none of those numbers, and a landing page that
 * invents them undermines the one thing this product sells: that its output is
 * measured rather than asserted. The layout is matched exactly; the content is
 * four properties the engine can actually demonstrate.
 */

const ITEMS: { key: string; icon: LucideIcon; tone: string }[] = [
  { key: 'precision', icon: Ruler, tone: 'text-accent' },
  { key: 'deterministic', icon: ShieldCheck, tone: 'text-success' },
  { key: 'speed', icon: Timer, tone: 'text-warning' },
  { key: 'languages', icon: Languages, tone: 'text-info' },
];

export async function ProofStrip() {
  const t = await getTranslations('marketing.proof');

  return (
    <section className="border-b border-line">
      <div className="page-container py-6">
        <ul className="grid grid-cols-1 divide-y divide-line rounded-panel border border-line bg-surface sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {ITEMS.map(({ key, icon: Icon, tone }) => (
            <li key={key} className="flex items-center gap-3.5 px-5 py-4">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-paper ${tone}`}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-base font-bold tracking-tight text-ink tabular-nums">
                  {t(`${key}.value`)}
                </p>
                <p className="truncate text-caption text-ink-faint">{t(`${key}.label`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
