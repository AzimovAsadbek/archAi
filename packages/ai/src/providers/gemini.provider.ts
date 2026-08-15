import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { ChatArchitectureAIProvider, type ChatOutcome, type ChatTurn } from './chat.provider';
import { AI_ERROR_CODES, type AiErrorCode } from '../types';

/**
 * Self-updating alias to the current Flash tier — verified available on the free
 * tier and immune to the version retirement that pulled `gemini-2.5-flash` for
 * new keys (checked live, Aug 2026). Override with `AI_PRIMARY_MODEL`.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

/** A web request cannot wait long; the router may still fall back to Groq. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Ample for a 40-room proposal plus notes; the schema keeps output compact. */
const MAX_OUTPUT_TOKENS = 8_192;

/**
 * Thinking off (`thinkingBudget: 0`): these are bounded extraction and advisory
 * tasks, not open reasoning, so disabling it cuts latency and free-tier token
 * spend without hurting quality.
 */
const THINKING_BUDGET = 0;

/** Low temperature — structured output should be near-deterministic. */
const TEMPERATURE = 0.2;

export interface GeminiProviderOptions {
  apiKey: string;
  /** Defaults to `DEFAULT_GEMINI_MODEL`; set from `AI_PRIMARY_MODEL`. */
  model?: string;
  timeoutMs?: number;
  /** Injected in tests. */
  client?: GoogleGenAI;
}

interface Turn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * Gemini-backed provider (primary runtime AI). It implements only the `complete`
 * primitive; every operation — parse, suggest, answer — is inherited from
 * `ChatArchitectureAIProvider`, which validates each reply against that
 * operation's schema. Never throws, never logs user text.
 */
export class GeminiArchitectureAIProvider extends ChatArchitectureAIProvider {
  readonly name = 'gemini';
  protected readonly model: string;

  private readonly client: GoogleGenAI;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    super();
    const model = options.model?.trim();
    this.model = model !== undefined && model.length > 0 ? model : DEFAULT_GEMINI_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.client = options.client ?? new GoogleGenAI({ apiKey: options.apiKey });
  }

  protected async complete(system: string, turns: ChatTurn[]): Promise<ChatOutcome> {
    try {
      const contents: Turn[] = turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));
      const response = await this.generate(system, contents);
      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

      const blocked = this.refusalReason(response);
      if (blocked) {
        return { ok: false, error: AI_ERROR_CODES.AI_REFUSED, message: blocked, inputTokens, outputTokens };
      }

      const text = response.text;
      if (text === undefined || text.trim().length === 0) {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_INVALID_OUTPUT,
          message: 'Gemini returned an empty response',
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

  private generate(system: string, contents: Turn[]): Promise<GenerateContentResponse> {
    return this.client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      },
    });
  }

  /** Non-null when the model or prompt was blocked and no answer is available. */
  private refusalReason(response: GenerateContentResponse): string | null {
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) return `Prompt blocked by Gemini safety (${blockReason})`;
    const finish = response.candidates?.[0]?.finishReason;
    if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST') {
      return `Gemini stopped for safety (${finish})`;
    }
    return null;
  }

  /**
   * Maps SDK failures onto stable codes by inspecting error shape rather than
   * `instanceof`, so it survives SDK internals changing. Messages are server-side
   * diagnostics and carry no user text.
   */
  private classify(error: unknown): { code: AiErrorCode; message: string } {
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : String(error);
    const status = this.statusOf(error);

    if (name === 'AbortError' || name === 'TimeoutError' || /abort|timed? ?out/i.test(message)) {
      return { code: AI_ERROR_CODES.AI_TIMEOUT, message: `Gemini request timed out after ${this.timeoutMs}ms` };
    }
    if (status === 429 || /rate.?limit|quota|resource.?exhausted/i.test(message)) {
      return { code: AI_ERROR_CODES.AI_RATE_LIMITED, message: 'Gemini rate limit or quota reached' };
    }
    if (status === 401 || status === 403) {
      return {
        code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
        message: 'Gemini rejected the credentials — GEMINI_API_KEY is invalid or lacks access',
      };
    }
    return {
      code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
      message: `Gemini API error${status ? ` (status=${status})` : ''}: ${message}`,
    };
  }

  private statusOf(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
}
