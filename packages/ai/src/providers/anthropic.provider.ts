import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { buildParseProjectPrompt, PARSE_PROJECT_PROMPT_VERSION } from '../prompts/parse-project';
import { projectProposalSchema } from '../schemas/proposal.schema';
import {
  AI_ERROR_CODES,
  type AiErrorCode,
  type AiProvenance,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
} from '../types';

/** Never a date-suffixed id — the alias always points at the current release. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5';

/** Generous enough for 40 rooms plus notes; the model also thinks by default. */
const MAX_TOKENS = 16_000;

/** A web request cannot wait for the SDK's 10-minute default. */
const DEFAULT_TIMEOUT_MS = 120_000;

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Defaults to `DEFAULT_ANTHROPIC_MODEL`; set from `ANTHROPIC_MODEL`. */
  model?: string;
  /** Injected in tests — production builds its own client from `apiKey`. */
  client?: Anthropic;
  timeoutMs?: number;
}

/**
 * Structured-output provider backed by the Anthropic API.
 *
 * Contract: it never throws and never logs user text. Every failure — SDK,
 * network, refusal or unparseable output — comes back as `{ ok: false }` with a
 * stable `AiErrorCode` and the provenance of the attempt.
 */
export class AnthropicArchitectureAIProvider implements ArchitectureAIProvider {
  readonly name = 'anthropic';

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions) {
    const model = options.model?.trim();
    this.model = model !== undefined && model.length > 0 ? model : DEFAULT_ANTHROPIC_MODEL;
    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
  }

  async parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    const startedAt = Date.now();
    const prompt = buildParseProjectPrompt(input);

    try {
      // Thinking is on by default on this model, and temperature/top_p/top_k are
      // rejected by it — the request stays deliberately minimal.
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.userMessage }],
        output_format: betaZodOutputFormat(projectProposalSchema),
      });

      const provenance: AiProvenance = {
        provider: this.name,
        model: response.model,
        promptVersion: PARSE_PROJECT_PROMPT_VERSION,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs: Date.now() - startedAt,
      };

      // Checked before any content is read: a refusal carries no usable output.
      if (response.stop_reason === 'refusal') {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_REFUSED,
          message: 'The model declined to answer this request',
          provenance,
        };
      }

      if (response.stop_reason === 'max_tokens') {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_INVALID_OUTPUT,
          message: `The response was truncated at ${MAX_TOKENS} tokens`,
          provenance,
        };
      }

      const proposal = response.parsed_output;
      if (proposal === null) {
        return {
          ok: false,
          error: AI_ERROR_CODES.AI_INVALID_OUTPUT,
          message: `The model returned no structured output (stop_reason=${response.stop_reason ?? 'unknown'})`,
          provenance,
        };
      }

      return { ok: true, proposal, provenance };
    } catch (error) {
      const failure = this.classify(error);
      return {
        ok: false,
        error: failure.code,
        message: failure.message,
        provenance: {
          provider: this.name,
          model: this.model,
          promptVersion: PARSE_PROJECT_PROMPT_VERSION,
          durationMs: Date.now() - startedAt,
        },
      };
    }
  }

  /**
   * Maps SDK failures onto stable codes. Messages are server-side diagnostics —
   * they carry no user text, and the API answers clients by code, not by message.
   */
  private classify(error: unknown): { code: AiErrorCode; message: string } {
    if (error instanceof Anthropic.RateLimitError) {
      return {
        code: AI_ERROR_CODES.AI_RATE_LIMITED,
        message: 'Anthropic rate limit reached',
      };
    }
    // Covers APIConnectionTimeoutError, which extends it.
    if (error instanceof Anthropic.APIConnectionError) {
      return {
        code: AI_ERROR_CODES.AI_TIMEOUT,
        message: `Could not reach the Anthropic API: ${error.message}`,
      };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return {
        code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
        message: 'Anthropic rejected the credentials — ANTHROPIC_API_KEY is invalid or revoked',
      };
    }
    if (error instanceof Anthropic.APIError) {
      return {
        code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
        message: `Anthropic API error (status=${error.status ?? 'unknown'}): ${error.message}`,
      };
    }
    // The zod output helper throws a plain AnthropicError when the model's JSON
    // does not satisfy the schema (the wire schema drops min/max constraints).
    if (error instanceof Anthropic.AnthropicError || error instanceof SyntaxError) {
      return {
        code: AI_ERROR_CODES.AI_INVALID_OUTPUT,
        message: `The model's output did not match the proposal schema: ${error.message}`,
      };
    }
    return {
      code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
      message: `Unexpected AI provider failure: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
