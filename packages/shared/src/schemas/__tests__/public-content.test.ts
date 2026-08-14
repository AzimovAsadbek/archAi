import { describe, expect, it } from 'vitest';
import {
  type BlogListItemDto,
  blogListItemDtoSchema,
  blogListQuerySchema,
  type BlogPostDto,
  blogPostDtoSchema,
  type FaqItemDto,
  faqItemDtoSchema,
  type PricingPlanDto,
  pricingPlanDtoSchema,
  type PricingResponse,
  pricingResponseSchema,
} from '../..';

const faqFixture: FaqItemDto = {
  id: 'faq_1',
  question: 'archAi nima?',
  answer: 'archAi uy loyihalash va taxminiy smeta yordamchisi.',
  category: 'umumiy',
  sortOrder: 0,
};

const blogListItemFixture: BlogListItemDto = {
  id: 'post_1',
  slug: 'uy-rejalashtirish-asoslari',
  title: 'Uy rejalashtirish asoslari',
  excerpt: 'Loyihani qayerdan boshlash kerak.',
  coverImageUrl: null,
  authorName: 'ArchAI jamoasi',
  category: 'rejalashtirish',
  tags: ['uy', 'reja'],
  publishedAt: '2026-08-01T00:00:00.000Z',
};

const blogPostFixture: BlogPostDto = {
  ...blogListItemFixture,
  body: '# Sarlavha\n\nMatn paragrafi.',
  metaTitle: 'Uy rejalashtirish asoslari — archAi',
  metaDescription: 'Uy qurilishini rejalashtirish bo‘yicha qo‘llanma.',
};

const pricingPlanFixture: PricingPlanDto = {
  id: 'plan_free',
  key: 'FREE',
  name: 'Bepul',
  tagline: 'Hozircha hammasi bepul',
  priceMonthly: 0,
  currency: 'UZS',
  limits: { projects: 3, aiParsesPerMonth: 10, pdfExportsPerMonth: 10, storageMb: 200 },
  features: ['projects_3', 'ai_parse', 'pdf_export'],
  sortOrder: 0,
};

const pricingResponseFixture: PricingResponse = {
  plans: [pricingPlanFixture, { ...pricingPlanFixture, id: 'plan_pro', key: 'PRO', sortOrder: 2 }],
  beta: true,
};

describe('public-content schemas', () => {
  it('accepts a valid FAQ item and a null category', () => {
    expect(faqItemDtoSchema.parse(faqFixture)).toEqual(faqFixture);
    expect(faqItemDtoSchema.parse({ ...faqFixture, category: null }).category).toBeNull();
  });

  it('accepts blog list item and full post fixtures', () => {
    expect(blogListItemDtoSchema.parse(blogListItemFixture)).toEqual(blogListItemFixture);
    expect(blogPostDtoSchema.parse(blogPostFixture).body).toContain('# Sarlavha');
  });

  it('coerces and defaults the public blog list query', () => {
    expect(blogListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
    const parsed = blogListQuerySchema.parse({ page: '2', pageSize: '5', tag: 'uy' });
    expect(parsed).toMatchObject({ page: 2, pageSize: 5, tag: 'uy' });
  });

  it('rejects a page size above the ceiling', () => {
    expect(blogListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('accepts a pricing response and requires beta:true with unlimited (null) limits', () => {
    expect(pricingResponseSchema.parse(pricingResponseFixture).beta).toBe(true);
    const unlimited = pricingPlanDtoSchema.parse({
      ...pricingPlanFixture,
      limits: { projects: null, aiParsesPerMonth: null, pdfExportsPerMonth: null, storageMb: null },
    });
    expect(unlimited.limits.projects).toBeNull();
    expect(pricingResponseSchema.safeParse({ plans: [], beta: false }).success).toBe(false);
  });
});
