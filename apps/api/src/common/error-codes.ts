/** Stable, machine-readable error codes returned in `ApiErrorShape.code`. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DOMAIN_VALIDATION_ERROR: 'DOMAIN_VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
  PROJECT_NOT_CONFIGURED: 'PROJECT_NOT_CONFIGURED',
  FLOOR_PLAN_UNAVAILABLE: 'FLOOR_PLAN_UNAVAILABLE',
  /**
   * No usable active `estimate_rules` row — a deployment fault (the seed
   * guarantees one). Logged and classified with this code; the client sees the
   * generic INTERNAL error, since the cause says nothing a user can act on.
   */
  ESTIMATE_RULES_MISSING: 'ESTIMATE_RULES_MISSING',
  /** AI provider outcomes — mirror `AiErrorCode` from `@archai/ai`. */
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_REFUSED: 'AI_REFUSED',
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
