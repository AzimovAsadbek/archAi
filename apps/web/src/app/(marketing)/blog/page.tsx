import { type Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { type BlogListItemDto, type BlogListResponse } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { listBlog } from '@/lib/endpoints';
import { absoluteUrl } from '@/lib/site';

const PAGE_SIZE = 12;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicContent.blog');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: absoluteUrl('/blog') },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: absoluteUrl('/blog'),
      type: 'website',
    },
  };
}

function blogHref(category: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/blog?${query}` : '/blog';
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('publicContent.blog');
  const format = await getFormatter();
  const params = await searchParams;

  const category = firstParam(params.category);
  const pageParam = Number(firstParam(params.page));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;

  let listing: BlogListResponse | null = null;
  let categories: string[] = [];
  try {
    // Second fetch builds a stable category bar independent of the active filter/page.
    const [primary, sample] = await Promise.all([
      listBlog({ category, page, pageSize: PAGE_SIZE }),
      listBlog({ pageSize: 50 }),
    ]);
    listing = primary;
    categories = [...new Set(sample.items.map((item) => item.category).filter((c): c is string => !!c))].sort();
  } catch {
    listing = null;
  }

  const items = listing?.items ?? [];
  const total = listing?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
      <header className="max-w-2xl">
        <p className="text-xs font-bold tracking-widest text-accent uppercase">{t('eyebrow')}</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">{t('subtitle')}</p>
      </header>

      {categories.length > 0 ? (
        <nav aria-label={t('filterLabel')} className="mt-8 flex flex-wrap items-center gap-2">
          <Link
            href={blogHref(undefined, 1)}
            aria-current={category === undefined ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
              category === undefined
                ? 'border-accent bg-accent-soft text-accent-strong'
                : 'border-line bg-surface text-ink-soft hover:text-ink'
            }`}
          >
            {t('allCategories')}
          </Link>
          {categories.map((name) => (
            <Link
              key={name}
              href={blogHref(name, 1)}
              aria-current={category === name ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                category === name
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-line bg-surface text-ink-soft hover:text-ink'
              }`}
            >
              {name}
            </Link>
          ))}
        </nav>
      ) : null}

      {listing === null ? (
        <Alert tone="warning" className="mt-8" live>
          {t('unavailable')}
        </Alert>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<ImageIcon className="size-5" />}
          title={t('empty.title')}
          description={t('empty.body')}
          action={
            category ? (
              <Link href={blogHref(undefined, 1)} className="text-sm font-semibold text-accent hover:underline">
                {t('empty.reset')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((post) => (
            <li key={post.id}>
              <BlogCard post={post} dateLabel={format.dateTime(new Date(post.publishedAt), { dateStyle: 'long' })} />
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label={t('pagination.label')}
          className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6"
        >
          {page > 1 ? (
            <Link href={blogHref(category, page - 1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
              <ChevronLeft className="size-4" aria-hidden="true" />
              {t('pagination.prev')}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
              <ChevronLeft className="size-4" aria-hidden="true" />
              {t('pagination.prev')}
            </span>
          )}
          <span className="numeric text-sm text-ink-soft">{t('pagination.info', { page, pages: pageCount })}</span>
          {page < pageCount ? (
            <Link href={blogHref(category, page + 1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
              {t('pagination.next')}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
              {t('pagination.next')}
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function BlogCard({ post, dateLabel }: { post: BlogListItemDto; dateLabel: string }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-shadow duration-150 hover:shadow-card"
    >
      <div className="aspect-[16/9] w-full overflow-hidden border-b border-line bg-paper">
        {post.coverImageUrl ? (
          // Plain <img>: covers are arbitrary external admin URLs and next/image remote domains are not configured here.
          <img src={post.coverImageUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-faint" aria-hidden="true">
            <ImageIcon className="size-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {post.category ? (
          <span className="mb-2">
            <Badge tone="faint" size="sm">
              {post.category}
            </Badge>
          </span>
        ) : null}
        <h2 className="text-base font-bold text-ink group-hover:text-accent-strong">{post.title}</h2>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-soft">{post.excerpt}</p>
        <p className="numeric mt-4 text-xs text-ink-faint">
          {post.authorName} · {dateLabel}
        </p>
      </div>
    </Link>
  );
}
