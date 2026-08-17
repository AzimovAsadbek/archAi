import { type Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Calculator, Mail, PlayCircle, SlidersHorizontal } from 'lucide-react';
import { CONTACT_EMAIL, absoluteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicContent.help');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: absoluteUrl('/help') },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: absoluteUrl('/help'),
      type: 'website',
    },
  };
}

export default async function HelpPage() {
  const t = await getTranslations('publicContent.help');

  const sections = [
    { key: 'start', icon: PlayCircle, title: t('sections.start.title'), body: t('sections.start.body') },
    {
      key: 'configurator',
      icon: SlidersHorizontal,
      title: t('sections.configurator.title'),
      body: t('sections.configurator.body'),
    },
    { key: 'estimate', icon: Calculator, title: t('sections.estimate.title'), body: t('sections.estimate.body') },
  ];

  // Framing sticks on the left; the guide becomes a two-up grid so the width is filled with content rather than a stretched line.

  return (
    <div className="page-container py-16 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.9fr)] lg:gap-16">
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
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map(({ key, icon: Icon, title, body }) => (
          <section key={key} className="flex gap-4 rounded-panel border border-line bg-surface p-6">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-accent" aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-panel border border-line bg-paper p-6">
        <h2 className="text-base font-bold text-ink">{t('faqTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('faqBody')}</p>
        <Link href="/faq" className="mt-3 inline-block text-sm font-semibold text-accent-strong hover:underline">
          {t('faqCta')}
        </Link>
      </section>

      <section id="contact" className="mt-5 scroll-mt-24 rounded-panel border border-line bg-surface p-6">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-accent" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink">{t('contactTitle')}</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('contactBody')}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong hover:underline"
        >
          <Mail className="size-4" aria-hidden="true" />
          {CONTACT_EMAIL}
        </a>
      </section>
        </div>
      </div>
    </div>
  );
}
