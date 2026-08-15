import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { buildParseProjectPrompt, PARSE_PROJECT_PROMPT_VERSION } from '../prompts/parse-project';
import { jsonOutputInstruction } from '../schemas/proposal.json-schema';
import { correctionInstruction, parseProposal } from './proposal-parsing';
import {
  AI_ERROR_CODES,
  type AiErrorCode,
  type AiProvenance,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
} from '../types';

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
 * Thinking off (`thinkingBudget: 0`): this is bounded extraction, not reasoning,
 * so disabling it cuts latency and free-tier token spend without hurting quality.
 */
const THINKING_BUDGET = 0;

/** Low temperature — extraction should be near-deterministic, not creative. */
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

const userTurn = (text: string): Turn => ({ role: 'user', parts: [{ text }] });
const modelTurn = (text: string): Turn => ({ role: 'model', parts: [{ text }] });

/**
 * Gemini-backed structured-output provider (primary runtime AI).
 *
 * Contract, shared with every provider: it never throws and never logs user
 * text. Pipeline: prompt → Gemini (`responseJsonSchema` constrained decoding) →
 * Zod validation → one correction pass on a schema miss → `ParseProjectResult`.
 * Every SDK, network, safety or validation failure returns `{ ok: false }` with
 * a stable `AiErrorCode`.
 */
export class GeminiArchitectureAIProvider implements ArchitectureAIProvider {
  readonly name = 'gemini';

  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    const model = options.model?.trim();
    this.model = model !== undefined && model.length > 0 ? model : DEFAULT_GEMINI_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.client = options.client ?? new GoogleGenAI({ apiKey: options.apiKey });
  }

  async parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    const startedAt = Date.now();
    const prompt = buildParseProjectPrompt(input);
    const system = prompt.system + jsonOutputInstruction();
    let inputTokens = 0;
    let outputTokens = 0;

    const provenance = (): AiProvenance => ({
      provider: this.name,
      model: this.model,
      promptVersion: PARSE_PROJECT_PROMPT_VERSION,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - startedAt,
    });

    try {
      let response = await this.generate(system, [userTurn(prompt.userMessage)]);
      inputTokens += response.usageMetadata?.promptTokenCount ?? 0;
      outputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;

      const blocked = this.refusalReason(response);
      if (blocked) {
        return { ok: false, error: AI_ERROR_CODES.AI_REFUSED, message: blocked, provenance: provenance() };
      }

      let text = response.text;
      if (text === undefined || text.trim().length === 0) {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_INVALID_OUTPUT,
          message: 'Gemini returned an empty response',
          provenance: provenance(),
        };
      }

      let parsed = parseProposal(text);

      // Single correction pass on a schema miss (never on non-JSON — constrained
      // decoding makes that a provider fault, not something a retry fixes).
      if (!parsed.ok && parsed.kind === 'schema') {
        response = await this.generate(system, [
          userTurn(prompt.userMessage),
          modelTurn(text),
          userTurn(correctionInstruction(parsed.detail)),
        ]);
        inputTokens += response.usageMetadata?.promptTokenCount ?? 0;
        outputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;
        text = response.text ?? '';
        parsed = parseProposal(text);
      }

      if (!parsed.ok) {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_INVALID_OUTPUT,
          message: `Gemini output did not match the proposal schema: ${parsed.detail}`,
          provenance: provenance(),
        };
      }

      return { ok: true, proposal: parsed.proposal, provenance: provenance() };
    } catch (error) {
      const failure = this.classify(error);
      return { ok: false, error: failure.code, message: failure.message, provenance: provenance() };
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
