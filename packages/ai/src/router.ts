import {
  AI_ERROR_CODES,
  type AiErrorCode,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
} from './types';

/**
 * Same-provider retry candidates: a fresh attempt at the *same* provider can
 * plausibly succeed (a dropped connection, a transient 5xx). A rate limit is
 * excluded — hitting the same limited provider again just fails again, so it
 * goes straight to the fallback instead.
 */
const RETRYABLE: ReadonlySet<AiErrorCode> = new Set([
  AI_ERROR_CODES.AI_TIMEOUT,
  AI_ERROR_CODES.AI_PROVIDER_ERROR,
]);

/**
 * Failures where a *different* provider might help. Deliberately excludes the
 * app/prompt faults — a refusal, a schema-invalid answer or a missing key are
 * not fixed by asking another model (§14: "do NOT blindly fallback").
 */
const FALLBACKABLE: ReadonlySet<AiErrorCode> = new Set([
  AI_ERROR_CODES.AI_TIMEOUT,
  AI_ERROR_CODES.AI_RATE_LIMITED,
  AI_ERROR_CODES.AI_PROVIDER_ERROR,
]);

export interface RoutingOptions {
  primary: ArchitectureAIProvider;
  /** Tried only when the primary fails with a fallbackable error. */
  fallback?: ArchitectureAIProvider;
  /** Same-provider retries on a retryable error, before any fallback. */
  maxRetries?: number;
  /** Base backoff; the nth retry waits `backoffMs * 2^n`. */
  backoffMs?: number;
  /** Injectable delay so tests run without real timers. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deterministic provider router. It is itself an `ArchitectureAIProvider`, so
 * the application service depends only on the interface and never learns whether
 * one provider or two answered. Provenance flows through unchanged: the returned
 * result's `provenance.provider` names whichever provider actually produced it.
 */
export class RoutingArchitectureAIProvider implements ArchitectureAIProvider {
  readonly name: string;

  private readonly primary: ArchitectureAIProvider;
  private readonly fallback?: ArchitectureAIProvider;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: RoutingOptions) {
    this.primary = options.primary;
    this.fallback = options.fallback;
    this.maxRetries = Math.max(0, options.maxRetries ?? 1);
    this.backoffMs = Math.max(0, options.backoffMs ?? 300);
    this.sleep = options.sleep ?? realSleep;
    // Identity is the primary's, so provenance-less diagnostics stay meaningful.
    this.name = options.primary.name;
  }

  async parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    const primaryResult = await this.attempt(this.primary, input);
    if (primaryResult.ok) return primaryResult;

    if (this.fallback && FALLBACKABLE.has(primaryResult.error)) {
      return this.attempt(this.fallback, input);
    }
    return primaryResult;
  }

  /** One call plus up to `maxRetries` backed-off retries on a retryable error. */
  private async attempt(
    provider: ArchitectureAIProvider,
    input: ParseProjectInput,
  ): Promise<ParseProjectResult> {
    let result = await provider.parseProjectRequest(input);
    for (let retry = 0; !result.ok && RETRYABLE.has(result.error) && retry < this.maxRetries; retry++) {
      await this.sleep(this.backoffMs * 2 ** retry);
      result = await provider.parseProjectRequest(input);
    }
    return result;
  }
}
