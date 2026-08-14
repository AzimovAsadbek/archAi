/**
 * Every value written to `audit_log.action`. Reads use `*.list` and are recorded
 * at most once per request; `/admin/audit` itself is deliberately not audited —
 * reading the trail is not a bypass of ownership rules.
 */
export const AUDIT_ACTIONS = {
  usersList: 'users.list',
  userActivate: 'user.activate',
  userDeactivate: 'user.deactivate',
  projectsList: 'projects.list',
  estimateRulesActivate: 'estimate-rules.activate',
  // Public content (docs/public-content.md): cross-content list reads + every mutation.
  faqList: 'faq.list',
  faqCreate: 'faq.create',
  faqUpdate: 'faq.update',
  faqDelete: 'faq.delete',
  blogList: 'blog.list',
  blogCreate: 'blog.create',
  blogUpdate: 'blog.update',
  blogPublish: 'blog.publish',
  blogDelete: 'blog.delete',
  pricingList: 'pricing.list',
  pricingCreate: 'pricing.create',
  pricingUpdate: 'pricing.update',
  pricingDeactivate: 'pricing.deactivate',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** `audit_log.entity` values — the affected resource kind, singular. */
export const AUDIT_ENTITIES = {
  user: 'user',
  project: 'project',
  estimateRule: 'estimate-rule',
  faq: 'faq',
  blogPost: 'blog-post',
  pricingPlan: 'pricing-plan',
} as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
