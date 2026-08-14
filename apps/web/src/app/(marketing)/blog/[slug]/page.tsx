import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { type BlogPostDto } from '@archai/shared';
import { Badge } from '@/components/ui/badge';
import { getBlogPost } from '@/lib/endpoints';
import { isApiError } from '@/lib/api';
import { Markdown } from '@/lib/markdown';
import { absoluteUrl, SITE_URL } from '@/lib/site';

async function loadPost(slug: string): Promise<BlogPostDto | null> {
  try {
    return await getBlogPost(slug);
  } catch (error) {
    if (isApiError(error) && error.statusCode === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug).catch(() => null);
  if (!post) return {};

  const description = post.metaDescription ?? post.excerpt;
  const url = absoluteUrl(`/blog/${post.slug}`);
  // A custom metaTitle is authored in full (it may already carry branding), so
  // bypass the root title template; a plain post falls back to the template.
  const title = post.metaTitle
    ? { absolute: post.metaTitle }
    : post.title;
  const ogTitle = post.metaTitle ?? post.title;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description,
      url,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.authorName],
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const t = await getTranslations('publicContent.blog');
  const format = await getFormatter();
  const dateLabel = format.dateTime(new Date(post.publishedAt), { dateStyle: 'long' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: { '@type': 'Person', name: post.authorName },
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 lg:py-16">
      {/* Structured data: JSON.stringify of our own object, with `<` escaped so the
          content can never break out of the script element. Safe by construction. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('back')}
      </Link>

      <header className="mt-6">
        {post.category ? (
          <span className="mb-3 inline-block">
            <Badge tone="accent" size="sm">
              {post.category}
            </Badge>
          </span>
        ) : null}
        <h1 className="text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">
          {post.title}
        </h1>
        <p className="numeric mt-4 text-sm text-ink-faint">
          {post.authorName} · {dateLabel}
        </p>
      </header>

      {post.coverImageUrl ? (
        <div className="mt-8 aspect-[16/9] w-full overflow-hidden rounded-lg border border-line bg-paper">
          {/* Plain <img>: covers are arbitrary external admin URLs and next/image remote domains are not configured here. */}
          <img src={post.coverImageUrl} alt="" className="size-full object-cover" />
        </div>
      ) : (
        <div
          className="mt-8 flex aspect-[16/9] w-full items-center justify-center rounded-lg border border-line bg-paper text-ink-faint"
          aria-hidden="true"
        >
          <ImageIcon className="size-10" />
        </div>
      )}

      <p className="mt-8 border-l-2 border-accent pl-4 text-lg leading-relaxed text-ink">
        {post.excerpt}
      </p>

      {/* Body is admin markdown, rendered without raw HTML — see lib/markdown.tsx. */}
      <Markdown source={post.body} className="mt-6 text-base" />

      {post.tags.length > 0 ? (
        <footer className="mt-10 border-t border-line pt-6">
          <h2 className="text-xs font-bold tracking-wide text-ink-faint uppercase">{t('tags')}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Badge tone="neutral" size="sm">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
