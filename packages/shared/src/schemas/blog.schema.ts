import { z } from 'zod';
import { type Paginated } from '../types/api.types';

/** Blog lifecycle. Only PUBLISHED posts are ever exposed on the public surface. */
export const BLOG_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

/**
 * Card shown in the public `GET /api/v1/blog` grid. Deliberately omits the body:
 * the list is cheap and the article is fetched by slug.
 */
export const blogListItemDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  coverImageUrl: z.string().nullable(),
  authorName: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  /** ISO timestamp; always set for a published post. */
  publishedAt: z.string(),
});
export type BlogListItemDto = z.infer<typeof blogListItemDtoSchema>;

/**
 * Full published article from `GET /api/v1/blog/:slug`. `body` is markdown source
 * returned verbatim — the web renders it safely, the API never emits HTML.
 */
export const blogPostDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  /** Markdown source. Render without raw HTML injection. */
  body: z.string(),
  authorName: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  coverImageUrl: z.string().nullable(),
  publishedAt: z.string(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
});
export type BlogPostDto = z.infer<typeof blogPostDtoSchema>;

/** Paginated public list envelope. */
export type BlogListResponse = Paginated<BlogListItemDto>;

/**
 * Query for the public blog list: page/size plus optional category and single-tag
 * filters. Coerced from query strings, so it doubles as the API validation schema.
 */
export const blogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(120).optional(),
});
export type BlogListQuery = z.infer<typeof blogListQuerySchema>;
