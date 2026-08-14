import {
  type BlogListItemDto,
  type BlogPostDto,
  type FaqItemDto,
  type PricingLimits,
  pricingLimitsSchema,
  type PricingPlanDto,
} from '@archai/shared';
import { type BlogPost, type FaqItem, type PricingPlan } from '@prisma/client';
import {
  type AdminBlogPostDto,
  type AdminFaqItemDto,
  type AdminPricingPlanDto,
} from './content.schema';

// ── FAQ ─────────────────────────────────────────────────────────────────────

export function toFaqItemDto(row: FaqItem): FaqItemDto {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    sortOrder: row.sortOrder,
  };
}

export function toAdminFaqItemDto(row: FaqItem): AdminFaqItemDto {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Blog ────────────────────────────────────────────────────────────────────

/** Only ever called for a published row, so `publishedAt` is present. */
export function toBlogListItemDto(row: BlogPost): BlogListItemDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    authorName: row.authorName,
    category: row.category,
    tags: row.tags,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
  };
}

export function toBlogPostDto(row: BlogPost): BlogPostDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    authorName: row.authorName,
    category: row.category,
    tags: row.tags,
    coverImageUrl: row.coverImageUrl,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
  };
}

export function toAdminBlogPostDto(row: BlogPost): AdminBlogPostDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    authorName: row.authorName,
    category: row.category,
    tags: row.tags,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Pricing ─────────────────────────────────────────────────────────────────

/**
 * `limits` is JSONB — re-validated on read so a malformed row can never reach the
 * client as an untyped blob. Admin writes go through the same schema, so this
 * only ever fails on hand-edited data.
 */
function toPricingLimits(value: PricingPlan['limits']): PricingLimits {
  return pricingLimitsSchema.parse(value);
}

export function toPricingPlanDto(row: PricingPlan): PricingPlanDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    tagline: row.tagline,
    priceMonthly: row.priceMonthly,
    currency: 'UZS',
    limits: toPricingLimits(row.limits),
    features: row.features,
    sortOrder: row.sortOrder,
  };
}

export function toAdminPricingPlanDto(row: PricingPlan): AdminPricingPlanDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    tagline: row.tagline,
    priceMonthly: row.priceMonthly,
    limits: toPricingLimits(row.limits),
    features: row.features,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
