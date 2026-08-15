import { Injectable } from '@nestjs/common';
import { type Env, validateEnv } from './env.schema';

/**
 * Typed access to validated environment configuration. Parsing happens once,
 * against the same zod schema used by the bootstrap validation hook.
 */
@Injectable()
export class AppConfigService {
  private readonly env: Env;

  constructor() {
    this.env = validateEnv(process.env);
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get apiPort(): number {
    return this.env.API_PORT;
  }

  get webOrigin(): string {
    return this.env.WEB_ORIGIN;
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.env.JWT_REFRESH_SECRET;
  }

  get accessTtlSec(): number {
    return this.env.JWT_ACCESS_TTL_SEC;
  }

  get refreshTtlSec(): number {
    return this.env.JWT_REFRESH_TTL_SEC;
  }

  get cookieSecure(): boolean {
    return this.env.COOKIE_SECURE;
  }

  get trustProxyHops(): number {
    return this.env.TRUST_PROXY_HOPS;
  }

  // ── Runtime AI (server-side only; keys never reach the client) ──────────
  get aiProvider(): string {
    return this.env.AI_PROVIDER;
  }

  get aiFallbackProvider(): string {
    return this.env.AI_FALLBACK_PROVIDER;
  }

  /** Undefined when the key is not set — a supported deployment state. */
  get geminiApiKey(): string | undefined {
    return this.env.GEMINI_API_KEY;
  }

  get groqApiKey(): string | undefined {
    return this.env.GROQ_API_KEY;
  }

  get aiPrimaryModel(): string | undefined {
    return this.env.AI_PRIMARY_MODEL;
  }

  get aiFallbackModel(): string | undefined {
    return this.env.AI_FALLBACK_MODEL;
  }

  get aiMaxRequestsPerUserPerDay(): number {
    return this.env.AI_MAX_REQUESTS_PER_USER_PER_DAY;
  }

  get aiTimeoutMs(): number {
    return this.env.AI_TIMEOUT_MS;
  }

  get aiMaxRetries(): number {
    return this.env.AI_MAX_RETRIES;
  }
}
