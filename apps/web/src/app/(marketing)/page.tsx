import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Box,
  Calculator,
  CloudUpload,
  FileText,
  Grid2x2,
  Languages,
  Layers,
  ListChecks,
  PenLine,
  Ruler,
  ScrollText,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeroSchematic } from '@/components/marketing/hero-schematic';
import { PlanSpecimen } from '@/components/marketing/plan-specimen';
import { ProofStrip } from '@/components/marketing/proof-strip';
import { Showcase } from '@/components/marketing/showcase';
import { SHOWCASE_BRIEF, buildShowcase } from '@/lib/showcase-project';

const HOW_STEPS = ['describe', 'validate', 'visualize', 'export'] as const;

/**
 * Four claims the hero makes, each one a property the product can actually
 * demonstrate — no customer counts, no invented averages. The reference puts a
 * stats strip here; ours states what the engine does instead of how popular it is.
 */
const HERO_PROOF: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'ai', icon: Sparkles },
  { key: 'precision', icon: Ruler },
  { key: 'trilingual', icon: Languages },
  { key: 'estimate', icon: Calculator },
];

/**
 * `roadmap: true` means the capability is NOT shipped yet and is badged as such.
 * Everything else is live today and must never be badged "coming soon" — the
 * landing page understating a working feature costs more than overstating one.
 */
const FEATURE_ITEMS: Array<{ key: string; icon: LucideIcon; roadmap: boolean }> = [
  { key: 'configurator', icon: SlidersHorizontal, roadmap: false },
  { key: 'ai', icon: Sparkles, roadmap: false },
  { key: 'plans', icon: Grid2x2, roadmap: false },
  { key: 'preview', icon: Box, roadmap: false },
  { key: 'estimate', icon: Calculator, roadmap: false },
  { key: 'pdf', icon: FileText, roadmap: false },
  { key: 'variants', icon: Layers, roadmap: false },
  { key: 'persist', icon: CloudUpload, roadmap: false },
];

const VALUE_ITEMS: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'structure', icon: ListChecks },
  { key: 'errors', icon: ShieldCheck },
  { key: 'language', icon: Wallet },
];

export default function LandingPage() {
  const t = useTranslations('marketing');
  const tCommon = useTranslations('common');
  // Computed per render from the real engine + estimate functions. Both are
  // pure, so this costs no database and no network call.
  const showcase = buildShowcase();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      {/* Two tracks at desktop: the pitch and the product itself. The drawing
          gets the wider track — it is the argument. */}
      <section className="border-b border-line">
        <div className="page-container grid gap-10 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14 lg:py-20">
          <div className="lg:pt-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-accent-strong">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t('hero.eyebrow')}
            </p>
            <h1 className="mt-5 text-4xl leading-[1.06] font-extrabold tracking-tight text-balance text-ink sm:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-5 max-w-xl leading-relaxed text-ink-soft">{t('hero.subtitle')}</p>

            <ul className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
              {HERO_PROOF.map(({ key, icon: Icon }) => (
                <li key={key} className="flex flex-col gap-1.5">
                  <span className="flex size-9 items-center justify-center rounded-sm border border-line bg-surface text-accent">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-bold text-ink">{t(`hero.proof.${key}.title`)}</span>
                  <span className="text-xs leading-snug text-ink-faint">
                    {t(`hero.proof.${key}.body`)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonClasses('accent', 'lg')}>
                {t('hero.ctaPrimary')}
              </Link>
              <Link href="/#how-it-works" className={buttonClasses('outline', 'lg')}>
                {t('hero.ctaSecondary')}
              </Link>
            </div>
          </div>

          <HeroSchematic />
        </div>
      </section>

      <ProofStrip />

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20 border-b border-line">
        <div className="page-container py-16 lg:py-20">
          <header className="max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {t('how.title')}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">{t('how.subtitle')}</p>
          </header>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((step, index) => (
              <li key={step} className="bg-surface p-6">
                <span className="numeric text-xs font-bold tracking-widest text-accent-strong">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-base font-bold text-ink">{t(`how.steps.${step}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {t(`how.steps.${step}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Showcase: real engine output, not a mock-up ──────────────── */}
      {showcase ? (
        <Showcase plan={showcase.plan} estimate={showcase.estimate} brief={SHOWCASE_BRIEF} />
      ) : null}

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 border-b border-line">
        <div className="page-container py-16 lg:py-20">
          <header className="max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {t('features.title')}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">{t('features.subtitle')}</p>
          </header>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_ITEMS.map(({ key, icon: Icon, roadmap }) => (
              <li key={key} className="rounded-md border border-line bg-surface p-6">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex size-9 items-center justify-center rounded-sm border border-line bg-paper text-ink-soft"
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  {roadmap ? (
                    <Badge tone="faint" size="sm">
                      {tCommon('roadmap')}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      {tCommon('live')}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-4 text-base font-bold text-ink">
                  {t(`features.items.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {t(`features.items.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── What you get + disclaimer ────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="page-container grid gap-10 py-16 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-20">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {t('value.title')}
            </h2>
            <ul className="mt-8 flex flex-col gap-6">
              {VALUE_ITEMS.map(({ key, icon: Icon }) => (
                <li key={key} className="flex gap-4">
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm border border-line bg-surface text-accent"
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-ink">
                      {t(`value.items.${key}.title`)}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {t(`value.items.${key}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside className="self-start rounded-md border border-line bg-surface p-6">
            <div className="flex items-center gap-2">
              <ScrollText className="size-4 text-warning" aria-hidden="true" />
              <h3 className="text-sm font-bold tracking-wide text-ink uppercase">
                {t('value.disclaimerTitle')}
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('value.disclaimer')}</p>
            <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
              {t('value.disclaimerSecondary')}
            </p>
          </aside>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      {/* The reference fills the right of this banner with a photograph. There
          are no photo assets, so the space is held by the product's own
          drawing: a blueprint grid with the showcase footprint set into it,
          which is both honest and on-brand for an architecture tool. */}
      <section>
        <div className="page-container py-16 lg:py-20">
          <div className="relative isolate overflow-hidden rounded-lg bg-shell">
            {/* Blueprint grid, fading out toward the copy so text stays legible. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage:
                  'linear-gradient(var(--color-shell-ink-faint) 1px, transparent 1px), linear-gradient(90deg, var(--color-shell-ink-faint) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
                maskImage: 'linear-gradient(100deg, transparent 28%, #000 78%)',
                WebkitMaskImage: 'linear-gradient(100deg, transparent 28%, #000 78%)',
              }}
            />
            {/* A single accent wash anchors the composition without a gradient
                sitting over the whole panel. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-16 size-[26rem] rounded-full opacity-25 blur-3xl"
              style={{ background: 'var(--color-accent)' }}
            />

            <div className="relative grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:p-14">
              <div>
                <p className="font-mono text-caption tracking-[0.18em] text-shell-ink-faint uppercase">
                  {t('finalCta.eyebrow')}
                </p>
                <h2 className="mt-3 text-3xl leading-[1.1] font-extrabold tracking-tight text-balance text-shell-ink sm:text-4xl">
                  {t('finalCta.title')}
                </h2>
                <p className="mt-4 max-w-lg leading-relaxed text-shell-ink-soft">
                  {t('finalCta.body')}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/register" className={buttonClasses('accent', 'lg')}>
                    <PenLine className="size-4" aria-hidden="true" />
                    {t('finalCta.cta')}
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-11 items-center rounded-md border border-shell-line px-5 text-sm font-semibold text-shell-ink-soft transition-colors hover:border-shell-ink-faint hover:text-shell-ink"
                  >
                    {t('finalCta.secondary')}
                  </Link>
                </div>
              </div>

              {showcase ? (
                <div className="hidden justify-self-end lg:block">
                  <div className="w-[19rem] rounded-panel border border-shell-line bg-surface p-3 shadow-card">
                    <div className="aspect-[4/3]">
                      <PlanSpecimen
                        plan={showcase.plan}
                        floorIndex={0}
                        label={t('finalCta.planAlt')}
                      />
                    </div>
                    <p className="mt-2 px-1 font-mono text-[11px] tabular-nums text-ink-faint">
                      {SHOWCASE_BRIEF.widthM} × {SHOWCASE_BRIEF.lengthM} m ·{' '}
                      {SHOWCASE_BRIEF.floorCount} · {showcase.plan.engineVersion}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
