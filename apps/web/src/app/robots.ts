import { type MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/** Allow all crawlers; keep the authenticated app and admin panel out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/projects', '/login', '/register'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
