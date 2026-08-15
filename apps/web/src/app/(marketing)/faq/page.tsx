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

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
      <header className="max-w-2xl">
        <p className="text-xs font-bold tracking-widest text-accent-strong uppercase">{t('eyebrow')}</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">{t('subtitle')}</p>
      </header>

      {groups === null ? (
        <Alert tone="warning" className="mt-8" live>
          {t('unavailable')}
        </Alert>
      ) : (
        <div className="mt-8">
          <FaqAccordion groups={groups} />
        </div>
      )}
    </div>
  );
}
