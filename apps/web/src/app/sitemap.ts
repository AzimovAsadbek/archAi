import { type MetadataRoute } from 'next';
import { listBlog } from '@/lib/endpoints';
import { absoluteUrl } from '@/lib/site';

/**
 * Marketing routes plus every published blog slug. The blog fetch is best-effort:
 * if the API is unreachable we still emit the static routes rather than failing
 * the whole sitemap (docs/public-content.md §SEO).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/pricing'), changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl('/blog'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/faq'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/help'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    // pageSize maxes at 50 server-side; enough for the current catalogue.
    const { items } = await listBlog({ pageSize: 50 }, 300);
    const posts: MetadataRoute.Sitemap = items.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'yearly',
      priority: 0.6,
    }));
    return [...staticRoutes, ...posts];
  } catch {
    return staticRoutes;
  }
}
