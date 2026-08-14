import { RATE_LIMIT_TTL_MS } from '../auth/auth.constants';

/**
 * Rendering a report costs real CPU (geometry + font subsetting), so exports get
 * the same 10-per-minute ceiling as auth and AI (docs/pdf-export.md §Endpoint).
 */
export const PDF_EXPORT_RATE_LIMIT = 10;

export const PDF_EXPORT_THROTTLE = {
  default: { limit: PDF_EXPORT_RATE_LIMIT, ttl: RATE_LIMIT_TTL_MS },
};
