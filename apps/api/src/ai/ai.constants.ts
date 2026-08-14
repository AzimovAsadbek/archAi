import { RATE_LIMIT_TTL_MS } from '../auth/auth.constants';

/**
 * DI token for the `ArchitectureAIProvider`. Everything AI-related is reached
 * through it, so e2e tests can bind a fake provider without touching the module.
 */
export const ARCHITECTURE_AI_PROVIDER = 'ARCHITECTURE_AI_PROVIDER';

/** AI calls cost money and latency: 10 per minute per IP, as for auth. */
export const AI_RATE_LIMIT = 10;

export const AI_THROTTLE = { default: { limit: AI_RATE_LIMIT, ttl: RATE_LIMIT_TTL_MS } };

/** Bounds for the free-text request accepted by `POST /ai/parse-project`. */
export const AI_REQUEST_TEXT = { min: 5, max: 2_000 } as const;
