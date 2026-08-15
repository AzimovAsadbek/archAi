import {
  AI_ERROR_CODES,
  type AiErrorCode,
  type AnswerResult,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
  type QuestionInput,
  type SuggestInput,
  type SuggestResult,
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

/** The shape every operation result shares: routing only needs ok + error code. */
type OperationResult = { ok: true } | { ok: false; error: AiErrorCode };

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
 * one provider or two answered. The retry-then-fallback policy is operation-
 * agnostic: every method routes through the same `route` helper, so a new
 * operation inherits identical resilience. Provenance flows through unchanged —
 * the returned result names whichever provider actually produced it.
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

  parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    return this.route((provider) => provider.parseProjectRequest(input));
  }

  suggestImprovements(input: SuggestInput): Promise<SuggestResult> {
    return this.route((provider) => provider.suggestImprovements(input));
  }

  answerQuestion(input: QuestionInput): Promise<AnswerResult> {
    return this.route((provider) => provider.answerQuestion(input));
  }

  /** primary (with retries) → fallback (with retries) on a fallbackable error. */
  private async route<R extends OperationResult>(
    call: (provider: ArchitectureAIProvider) => Promise<R>,
  ): Promise<R> {
    const primary = await this.attempt(call, this.primary);
    if (primary.ok) return primary;

    if (this.fallback && FALLBACKABLE.has(primary.error)) {
      return this.attempt(call, this.fallback);
    }
    return primary;
  }

  /** One call plus up to `maxRetries` backed-off retries on a retryable error. */
  private async attempt<R extends OperationResult>(
    call: (provider: ArchitectureAIProvider) => Promise<R>,
    provider: ArchitectureAIProvider,
  ): Promise<R> {
    let result = await call(provider);
    for (let retry = 0; !result.ok && RETRYABLE.has(result.error) && retry < this.maxRetries; retry++) {
      await this.sleep(this.backoffMs * 2 ** retry);
      result = await call(provider);
    }
    return result;
  }
}
