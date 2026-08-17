import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { type FaqItemDto } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { FaqAccordion, type FaqGroup } from '@/components/marketing/faq-accordion';
import { getFaq } from '@/lib/endpoints';
import { absoluteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicContent.faq');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: absoluteUrl('/faq') },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: absoluteUrl('/faq'),
      type: 'website',
    },
  };
}

/** Groups published items by category, preserving the API's (category, sortOrder) order. */
function groupByCategory(items: FaqItemDto[]): FaqGroup[] {
  const order: (string | null)[] = [];
  const buckets = new Map<string | null, FaqItemDto[]>();

  for (const item of items) {
    const key = item.category;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }

  // Named categories first, the catch-all (null) bucket last.
  return order
    .sort((a, b) => (a === null ? 1 : b === null ? -1 : 0))
    .map((category) => ({ category, items: buckets.get(category)! }));
}

export default async function FaqPage() {
  const t = await getTranslations('publicContent.faq');

  let groups: FaqGroup[] | null = null;
  try {
    groups = groupByCategory((await getFaq()).items);
  } catch {
    groups = null;
  }

  // Two tracks: framing stays put on the left while the answers scroll past it. At 1440 a single measured column would leave half the page empty; this fills the width with structure rather than by stretching the text.

  return (
    <div className="page-container py-16 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:gap-16">
        <header className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-caption font-bold tracking-widest text-accent-strong uppercase">
            {t('eyebrow')}
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 leading-relaxed text-ink-soft">{t('subtitle')}</p>
        </header>

        <div className="min-w-0">
          {groups === null ? (
            <Alert tone="warning" live>
              {t('unavailable')}
            </Alert>
          ) : (
            <FaqAccordion groups={groups} />
          )}
        </div>
      </div>
    </div>
  );
}
