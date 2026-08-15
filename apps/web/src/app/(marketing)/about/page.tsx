import { type Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ListChecks, Mail, ScrollText, Target } from 'lucide-react';
import { CONTACT_EMAIL, absoluteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicContent.about');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: absoluteUrl('/about') },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: absoluteUrl('/about'),
      type: 'website',
    },
  };
}

export default async function AboutPage() {
  const t = await getTranslations('publicContent.about');

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
      <header className="max-w-2xl">
        <p className="text-xs font-bold tracking-widest text-accent-strong uppercase">{t('eyebrow')}</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">{t('subtitle')}</p>
      </header>

      <div className="mt-10 flex flex-col gap-8">
        <section className="flex gap-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-accent" aria-hidden="true">
            <Target className="size-4" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">{t('missionTitle')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('mission')}</p>
          </div>
        </section>

        <section className="flex gap-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-accent" aria-hidden="true">
            <ListChecks className="size-4" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">{t('howTitle')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('howBody')}</p>
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface p-6">
          <div className="flex items-center gap-2">
            <ScrollText className="size-4 text-warning" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-wide text-ink uppercase">{t('honestyTitle')}</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('honesty')}</p>
        </section>

        <section className="rounded-md border border-line bg-paper p-6">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-accent" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-wide text-ink uppercase">{t('contactTitle')}</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('contactBody')}</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong hover:underline"
          >
            <Mail className="size-4" aria-hidden="true" />
            {CONTACT_EMAIL}
          </a>
        </section>
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <Link href="/register" className="text-sm font-semibold text-accent-strong hover:underline">
          {t('cta')}
        </Link>
      </div>
    </div>
  );
}
