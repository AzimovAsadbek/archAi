import { type Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Check, Sparkles } from 'lucide-react';
import { type PricingLimits, type PricingPlanDto } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { getPricing } from '@/lib/endpoints';
import { formatUZS } from '@/lib/format';
import { absoluteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicContent.pricing');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: absoluteUrl('/pricing') },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: absoluteUrl('/pricing'),
      type: 'website',
    },
  };
}

type Translator = Awaited<ReturnType<typeof getTranslations<'publicContent.pricing'>>>;

const LIMIT_FIELDS = ['projects', 'aiParsesPerMonth', 'pdfExportsPerMonth', 'storageMb'] as const;

function limitLabel(t: Translator, field: (typeof LIMIT_FIELDS)[number]): string {
  // Literal keys so the i18n checker can verify every one.
  switch (field) {
    case 'projects':
      return t('limits.projects');
    case 'aiParsesPerMonth':
      return t('limits.aiParsesPerMonth');
    case 'pdfExportsPerMonth':
      return t('limits.pdfExportsPerMonth');
    case 'storageMb':
      return t('limits.storageMb');
  }
}

function limitValue(t: Translator, field: (typeof LIMIT_FIELDS)[number], limits: PricingLimits): string {
  const value = limits[field];
  if (value === null) return t('unlimited');
  if (field === 'storageMb') return t('storageValue', { mb: value });
  return String(value);
}

/** Feature strings are display keys; map the known ones, fall back to the raw string. */
function featureLabel(t: Translator, key: string): string {
  return t.has(`features.${key}`) ? t(`features.${key}`) : key;
}

function PlanCard({ t, plan, highlight }: { t: Translator; plan: PricingPlanDto; highlight: boolean }) {
  return (
    <div
      className={`relative flex flex-col rounded-lg border bg-surface p-6 sm:p-7 ${
        highlight ? 'border-accent shadow-card' : 'border-line'
      }`}
    >
      {highlight ? (
        <span className="absolute -top-3 left-6">
          <Badge tone="accent">{t('popular')}</Badge>
        </span>
      ) : null}

      <h2 className="text-lg font-extrabold tracking-tight text-ink">{plan.name}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{plan.tagline}</p>

      <div className="mt-5 border-y border-line py-4">
        <p className="text-2xl font-extrabold tracking-tight text-ink">{t('free')}</p>
        {plan.priceMonthly > 0 ? (
          <p className="numeric mt-1 text-xs text-ink-faint">
            {t('futurePrice', { price: formatUZS(plan.priceMonthly) })}
          </p>
        ) : null}
      </div>

      {plan.features.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-soft">
              <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>{featureLabel(t, feature)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-5 text-sm">
        {LIMIT_FIELDS.map((field) => (
          <div key={field} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-faint">{limitLabel(t, field)}</dt>
            <dd className="numeric font-semibold text-ink">{limitValue(t, field, plan.limits)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 pt-1">
        <Link href="/register" className={buttonClasses(highlight ? 'accent' : 'outline', 'md', 'w-full')}>
          {t('cta')}
        </Link>
      </div>
    </div>
  );
}

export default async function PricingPage() {
  const t = await getTranslations('publicContent.pricing');

  let plans: PricingPlanDto[] | null = null;
  try {
    plans = (await getPricing()).plans;
  } catch {
    plans = null;
  }

  return (
    <div className="page-container py-16 lg:py-20">
      <header className="max-w-2xl">
        <p className="text-xs font-bold tracking-widest text-accent-strong uppercase">{t('eyebrow')}</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">{t('subtitle')}</p>
      </header>

      <Alert tone="info" title={t('betaBannerTitle')} className="mt-8">
        {t('betaBanner')}
      </Alert>

      {plans === null ? (
        <Alert tone="warning" className="mt-8" live>
          {t('unavailable')}
        </Alert>
      ) : plans.length === 0 ? (
        <p className="mt-10 text-sm text-ink-soft">{t('empty')}</p>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <PlanCard key={plan.id} t={t} plan={plan} highlight={plans!.length >= 3 && index === 1} />
          ))}
        </div>
      )}

      <div className="mt-12 flex items-center gap-2 text-sm text-ink-faint">
        <Sparkles className="size-4 text-accent" aria-hidden="true" />
        <p>{t('footnote')}</p>
      </div>
    </div>
  );
}
