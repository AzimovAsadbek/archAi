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
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** `audit_log.entity` values — the affected resource kind, singular. */
export const AUDIT_ENTITIES = {
  user: 'user',
  project: 'project',
  estimateRule: 'estimate-rule',
} as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
