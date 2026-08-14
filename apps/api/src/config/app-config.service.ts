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

  /** Undefined when AI is not configured — a supported deployment state. */
  get anthropicApiKey(): string | undefined {
    return this.env.ANTHROPIC_API_KEY;
  }

  get anthropicModel(): string | undefined {
    return this.env.ANTHROPIC_MODEL;
  }
}
