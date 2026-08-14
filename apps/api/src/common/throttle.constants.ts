import { RATE_LIMIT_TTL_MS } from '../auth/auth.constants';

/**
 * Floor plans and estimates recompute on demand — the floor-plan GET regenerates
 * and writes geometry, the estimate reprices — so they cost more than a plain read
 * yet less than a PDF render. Both sit above the global bucket on a shared, moderate
 * ceiling: 30 per minute per IP.
 */
export const GENERATE_RATE_LIMIT = 30;

export const GENERATE_THROTTLE = {
  default: { limit: GENERATE_RATE_LIMIT, ttl: RATE_LIMIT_TTL_MS },
};
