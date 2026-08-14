import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'production'] as const;

/** Accepts the usual textual booleans found in .env files. */
const envBoolean = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(2_592_000),
  COOKIE_SECURE: envBoolean.default(false),
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
