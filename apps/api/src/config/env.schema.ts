import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'production'] as const;

/** Accepts the usual textual booleans found in .env files. */
const envBoolean = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

/** Blank values in a .env file mean "not set", not "set to an empty string". */
const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : undefined;
  });

export const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(2_592_000),
    COOKIE_SECURE: envBoolean.default(false),
    /**
     * Number of trusted reverse-proxy hops in front of the API. 0 = none (the
     * socket IP is the client). Set to the real hop count in production so the
     * per-IP rate limiter keys on the forwarded client IP, not the proxy.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    /**
     * Server-side only. Empty or missing is a supported state: the AI provider
     * then answers `AI_NOT_CONFIGURED` (503) instead of the app refusing to boot.
     */
    ANTHROPIC_API_KEY: optionalString,
    /** Model override; `@archai/ai` falls back to its own default. */
    ANTHROPIC_MODEL: optionalString,
  })
  // Session cookies must be Secure in production, or auth rides plain HTTP.
  .refine((env) => env.NODE_ENV !== 'production' || env.COOKIE_SECURE, {
    path: ['COOKIE_SECURE'],
    error: 'COOKIE_SECURE must be true when NODE_ENV=production',
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Fail-fast environment validation. Used both as the `@nestjs/config` validate
 * hook (so the process dies at bootstrap on bad config) and by AppConfigService.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${details}`);
  }
  return result.data;
}
