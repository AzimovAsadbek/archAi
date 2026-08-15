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
    // ── Runtime AI (free-tier-first; server-side only) ────────────────────
    /** Primary runtime provider. `mock` needs no key. */
    AI_PROVIDER: z.enum(['gemini', 'groq', 'mock']).default('gemini'),
    /** Runtime fallback, tried only when the primary errors. `none` disables it. */
    AI_FALLBACK_PROVIDER: z.enum(['gemini', 'groq', 'mock', 'none']).default('groq'),
    /**
     * Provider keys. Empty/missing is supported: if the *primary* key is absent
     * the AI endpoint answers `AI_NOT_CONFIGURED` (503) rather than refusing to
     * boot — the rest of the product still works.
     */
    GEMINI_API_KEY: optionalString,
    GROQ_API_KEY: optionalString,
    /** Model overrides; each provider falls back to its own verified default. */
    AI_PRIMARY_MODEL: optionalString,
    AI_FALLBACK_MODEL: optionalString,
    /** Per-user requests/day; 0 disables the app-level quota. Provider limits still apply. */
    AI_MAX_REQUESTS_PER_USER_PER_DAY: z.coerce.number().int().min(0).default(20),
    /** Per-provider request timeout. */
    AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    /** Same-provider retries on a transient error before falling back. */
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
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
