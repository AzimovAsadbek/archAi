import Groq from 'groq-sdk';
import { ChatArchitectureAIProvider, type ChatOutcome, type ChatTurn } from './chat.provider';
import { AI_ERROR_CODES, type AiErrorCode } from '../types';

/**
 * Verified current Groq production model (checked live, Aug 2026):
 * `llama-3.3-70b-versatile` was decommissioned, so the default is `gpt-oss-120b`
 * — available and structured-output capable. Override with `AI_FALLBACK_MODEL`.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TOKENS = 8_192;
const TEMPERATURE = 0.2;

export interface GroqProviderOptions {
  apiKey: string;
  /** Defaults to `DEFAULT_GROQ_MODEL`; set from `AI_FALLBACK_MODEL`. */
  model?: string;
  timeoutMs?: number;
  /** Injected in tests. */
  client?: Groq;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Groq-backed provider (fallback runtime AI). Implements only the `complete`
 * primitive; parse, suggest and answer are inherited from the base and share the
 * same validate → correct pipeline. Only the SDK call and error surface differ
 * from Gemini, which is exactly what the abstraction is for.
 */
export class GroqArchitectureAIProvider extends ChatArchitectureAIProvider {
  readonly name = 'groq';
  protected readonly model: string;

  private readonly client: Groq;
  private readonly timeoutMs: number;

  constructor(options: GroqProviderOptions) {
    super();
    const model = options.model?.trim();
    this.model = model !== undefined && model.length > 0 ? model : DEFAULT_GROQ_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.client = options.client ?? new Groq({ apiKey: options.apiKey });
  }

  protected async complete(system: string, turns: ChatTurn[]): Promise<ChatOutcome> {
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: system },
        ...turns.map(
          (turn): ChatMessage => ({
            role: turn.role === 'model' ? 'assistant' : 'user',
            content: turn.text,
          }),
        ),
      ];

      const completion = await this.chat(messages);
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const choice = completion.choices[0];

      // Coerced: the SDK's finish_reason union omits content_filter, but the
      // OpenAI-compatible wire can still send it, and it means a hard refusal.
      if (String(choice?.finish_reason) === 'content_filter') {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_REFUSED,
          message: 'Groq stopped for content filtering',
          inputTokens,
          outputTokens,
        };
      }

      const text = choice?.message?.content ?? '';
      if (text.trim().length === 0) {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_INVALID_OUTPUT,
          message: 'Groq returned an empty response',
          inputTokens,
          outputTokens,
        };
      }
      return { ok: true, text, inputTokens, outputTokens };
    } catch (error) {
      const failure = this.classify(error);
      return { ok: false, error: failure.code, message: failure.message, inputTokens: 0, outputTokens: 0 };
    }
  }

  private chat(messages: ChatMessage[]): Promise<Groq.Chat.Completions.ChatCompletion> {
    return this.client.chat.completions.create(
      {
        model: this.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      },
      { signal: AbortSignal.timeout(this.timeoutMs) },
    );
  }

  private classify(error: unknown): { code: AiErrorCode; message: string } {
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : String(error);
    const status =
      typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : undefined;

    if (name === 'AbortError' || name === 'TimeoutError' || /abort|timed? ?out/i.test(message)) {
      return { code: AI_ERROR_CODES.AI_TIMEOUT, message: `Groq request timed out after ${this.timeoutMs}ms` };
    }
    if (status === 429 || /rate.?limit|quota/i.test(message)) {
      return { code: AI_ERROR_CODES.AI_RATE_LIMITED, message: 'Groq rate limit or quota reached' };
    }
    if (status === 401 || status === 403) {
      return {
        code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
        message: 'Groq rejected the credentials — GROQ_API_KEY is invalid or lacks access',
      };
    }
    return {
      code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
      message: `Groq API error${status ? ` (status=${status})` : ''}: ${message}`,
    };
  }
}
