import { z } from 'zod';

/** Stable plan keys (docs/public-content.md §Pricing). */
export const PRICING_PLAN_KEYS = ['FREE', 'BASIC', 'PRO'] as const;
export type PricingPlanKey = (typeof PRICING_PLAN_KEYS)[number];

/**
 * Per-plan quotas. `null` means unlimited. NOT enforced in v1 — plans are
 * informational while the product is free during beta.
 */
export const pricingLimitsSchema = z.object({
  projects: z.number().int().nullable(),
  aiParsesPerMonth: z.number().int().nullable(),
  pdfExportsPerMonth: z.number().int().nullable(),
  storageMb: z.number().int().nullable(),
});
export type PricingLimits = z.infer<typeof pricingLimitsSchema>;

/** One active plan card from `GET /api/v1/pricing`. */
export const pricingPlanDtoSchema = z.object({
  id: z.string(),
  /** FREE | BASIC | PRO. Typed as string for forward-compatibility with new tiers. */
  key: z.string(),
  name: z.string(),
  tagline: z.string(),
  /** UZS per month; 0 for the free plan. Informational — no checkout exists. */
  priceMonthly: z.number().int(),
  currency: z.literal('UZS'),
  limits: pricingLimitsSchema,
  features: z.array(z.string()),
  sortOrder: z.number().int(),
});
export type PricingPlanDto = z.infer<typeof pricingPlanDtoSchema>;

/**
 * `GET /api/v1/pricing` envelope. `beta` is always `true` in v1: the honest signal
 * to the web that everything is free and no payment integration is wired.
 */
export const pricingResponseSchema = z.object({
  plans: z.array(pricingPlanDtoSchema),
  beta: z.literal(true),
});
export type PricingResponse = z.infer<typeof pricingResponseSchema>;
