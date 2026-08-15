import {
  BLOG_STATUSES,
  type BlogStatus,
  type PricingLimits,
  pricingLimitsSchema,
} from '@archai/shared';
import { z } from 'zod';

/** Hard ceiling for admin content lists (mirrors the admin panel default). */
export const CONTENT_PAGE_SIZE_MAX = 50;
const CONTENT_PAGE_SIZE_DEFAULT = 20;

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(CONTENT_PAGE_SIZE_MAX)
    .default(CONTENT_PAGE_SIZE_DEFAULT),
};

// ── FAQ ─────────────────────────────────────────────────────────────────────

export const listAdminFaqQuerySchema = z.object({
  ...paginationShape,
  category: z.string().trim().max(80).optional(),
});
export type ListAdminFaqQuery = z.infer<typeof listAdminFaqQuerySchema>;

export const createFaqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(5000),
  category: z.string().trim().max(80).nullish(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  isPublished: z.boolean().optional(),
});
export type CreateFaqInput = z.infer<typeof createFaqSchema>;

/** Every field optional — a PATCH touches only what it names. */
export const updateFaqSchema = createFaqSchema.partial();
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;

export interface AdminFaqItemDto {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Blog ────────────────────────────────────────────────────────────────────

/**
 * A cover image is emitted into public `<img src>`, `og:image` and JSON-LD, so it
 * must be an absolute https URL (blocks trackers over http, `javascript:`/`data:`
 * junk, and mixed content) or a same-origin path.
 */
export const coverImageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => /^https:\/\/\S+$/i.test(value) || /^\/[^/]/.test(value),
    'invalid_cover_image_url',
  );

/** Lowercase kebab slug — the only shape `GET /blog/:slug` will ever match. */
export const blogSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid_slug');

export const listAdminBlogQuerySchema = z.object({
  ...paginationShape,
  status: z.enum(BLOG_STATUSES).optional(),
  category: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(40).optional(),
});
export type ListAdminBlogQuery = z.infer<typeof listAdminBlogQuerySchema>;

/**
 * `publishedAt` is server-managed — stamped when a post first goes PUBLISHED — so
 * it is deliberately absent from the input. `body` is markdown stored verbatim.
 */
export const createBlogSchema = z.object({
  slug: blogSlugSchema,
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(50_000),
  authorName: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  coverImageUrl: coverImageUrlSchema.nullish(),
  status: z.enum(BLOG_STATUSES).optional(),
  metaTitle: z.string().trim().max(200).nullish(),
  metaDescription: z.string().trim().max(400).nullish(),
});
export type CreateBlogInput = z.infer<typeof createBlogSchema>;

export const updateBlogSchema = createBlogSchema.partial();
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;

export interface AdminBlogPostDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  authorName: string;
  category: string | null;
  tags: string[];
  coverImageUrl: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Pricing ─────────────────────────────────────────────────────────────────

export const listAdminPricingQuerySchema = z.object({
  ...paginationShape,
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type ListAdminPricingQuery = z.infer<typeof listAdminPricingQuerySchema>;

export const createPricingSchema = z.object({
  key: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,30}$/, 'invalid_key'),
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().min(1).max(200),
  priceMonthly: z.number().int().min(0).max(1_000_000_000),
  limits: pricingLimitsSchema,
  features: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});
export type CreatePricingInput = z.infer<typeof createPricingSchema>;

/** `key` cannot be changed once set — it is the stable public lookup handle. */
export const updatePricingSchema = createPricingSchema.omit({ key: true }).partial();
export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;

export interface AdminPricingPlanDto {
  id: string;
  key: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  limits: PricingLimits;
  features: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
