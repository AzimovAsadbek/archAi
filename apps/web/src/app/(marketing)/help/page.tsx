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

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
      <header className="max-w-2xl">
        <p className="text-xs font-bold tracking-widest text-accent uppercase">{t('eyebrow')}</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">{t('subtitle')}</p>
      </header>

      <div className="mt-10 flex flex-col gap-5">
        {sections.map(({ key, icon: Icon, title, body }) => (
          <section key={key} className="flex gap-4 rounded-md border border-line bg-surface p-6">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-accent" aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-md border border-line bg-paper p-6">
        <h2 className="text-base font-bold text-ink">{t('faqTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('faqBody')}</p>
        <Link href="/faq" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          {t('faqCta')}
        </Link>
      </section>

      <section className="mt-5 rounded-md border border-line bg-surface p-6">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-accent" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink">{t('contactTitle')}</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('contactBody')}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
        >
          <Mail className="size-4" aria-hidden="true" />
          {CONTACT_EMAIL}
        </a>
      </section>
    </div>
  );
}
