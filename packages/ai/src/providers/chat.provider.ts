import { type ZodType } from 'zod';
import { buildParseProjectPrompt, PARSE_PROJECT_PROMPT_VERSION } from '../prompts/parse-project';
import {
  buildSuggestImprovementsPrompt,
  SUGGEST_IMPROVEMENTS_PROMPT_VERSION,
} from '../prompts/suggest-improvements';
import {
  buildAnswerQuestionPrompt,
  ANSWER_QUESTION_PROMPT_VERSION,
} from '../prompts/answer-question';
import { jsonOutputInstruction } from '../schemas/proposal.json-schema';
import { projectProposalSchema } from '../schemas/proposal.schema';
import { ANSWER_JSON_SCHEMA, answerOutputSchema } from '../schemas/answer.schema';
import { SUGGESTIONS_JSON_SCHEMA, suggestionsOutputSchema } from '../schemas/suggestions.schema';
import {
  correctionInstruction,
  jsonSchemaInstruction,
  parseStructured,
} from './structured-output';
import {
  AI_ERROR_CODES,
  type AiErrorCode,
  type AiProvenance,
  type AnswerResult,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
  type QuestionInput,
  type SuggestInput,
  type SuggestResult,
} from '../types';

/** One conversational turn passed to a provider's `complete` primitive. */
export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Result of the single SDK-specific primitive. A provider classifies its own
 * refusals, timeouts and API errors into a stable `AiErrorCode` here and never
 * throws — the shared runner above it only ever sees this shape. Tokens are
 * reported per call so the runner can total them across a correction pass.
 */
export type ChatOutcome =
  | { ok: true; text: string; inputTokens: number; outputTokens: number }
  | { ok: false; error: AiErrorCode; message: string; inputTokens: number; outputTokens: number };

type StructuredOutcome<T> =
  | { ok: true; data: T; provenance: AiProvenance }
  | { ok: false; error: AiErrorCode; message: string; provenance: AiProvenance };

/**
 * Base for network-backed providers (Gemini, Groq). A subclass implements one
 * primitive — `complete(system, turns)` — and inherits every structured
 * operation for free: build the prompt, call the model, validate against the
 * operation's Zod schema, make one correction pass on a schema miss, and return
 * a stable result with provenance. Adding an operation is one method here, not
 * one per provider, which is the whole point of the abstraction.
 */
export abstract class ChatArchitectureAIProvider implements ArchitectureAIProvider {
  abstract readonly name: string;
  protected abstract readonly model: string;

  /**
   * The only provider-specific code path. Must never throw: SDK, network, safety
   * and empty-output failures all come back as `{ ok: false }` with a classified
   * code. `system` carries the output-format schema; `turns` is the dialogue so
   * far (the correction pass appends the model's bad answer and a fix request).
   */
  protected abstract complete(system: string, turns: ChatTurn[]): Promise<ChatOutcome>;

  async parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    const prompt = buildParseProjectPrompt(input);
    const out = await this.runStructured(
      prompt.system + jsonOutputInstruction(),
      prompt.userMessage,
      projectProposalSchema,
      PARSE_PROJECT_PROMPT_VERSION,
    );
    if (out.ok) return { ok: true, proposal: out.data, provenance: out.provenance };
    return { ok: false, error: out.error, message: out.message, provenance: out.provenance };
  }

  async suggestImprovements(input: SuggestInput): Promise<SuggestResult> {
    const prompt = buildSuggestImprovementsPrompt(input);
    const out = await this.runStructured(
      prompt.system + jsonSchemaInstruction(SUGGESTIONS_JSON_SCHEMA),
      prompt.userMessage,
      suggestionsOutputSchema,
      SUGGEST_IMPROVEMENTS_PROMPT_VERSION,
    );
    if (out.ok) return { ok: true, suggestions: out.data, provenance: out.provenance };
    return { ok: false, error: out.error, message: out.message, provenance: out.provenance };
  }

  async answerQuestion(input: QuestionInput): Promise<AnswerResult> {
    const prompt = buildAnswerQuestionPrompt(input);
    const out = await this.runStructured(
      prompt.system + jsonSchemaInstruction(ANSWER_JSON_SCHEMA),
      prompt.userMessage,
      answerOutputSchema,
      ANSWER_QUESTION_PROMPT_VERSION,
    );
    if (out.ok) return { ok: true, answer: out.data, provenance: out.provenance };
    return { ok: false, error: out.error, message: out.message, provenance: out.provenance };
  }

  /** build → complete → validate → one correction pass → structured result. */
  private async runStructured<T>(
    system: string,
    user: string,
    schema: ZodType<T>,
    promptVersion: string,
  ): Promise<StructuredOutcome<T>> {
    const startedAt = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    const provenance = (): AiProvenance => ({
      provider: this.name,
      model: this.model,
      promptVersion,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - startedAt,
    });

    const first = await this.complete(system, [{ role: 'user', text: user }]);
    inputTokens += first.inputTokens;
    outputTokens += first.outputTokens;
    if (!first.ok) return { ok: false, error: first.error, message: first.message, provenance: provenance() };

    let parsed = parseStructured(first.text, schema);

    // One correction pass on a schema miss only — not on refusal, empty output or
    // non-JSON, none of which a re-ask with the same schema would fix.
    if (!parsed.ok && parsed.kind === 'schema') {
      const second = await this.complete(system, [
        { role: 'user', text: user },
        { role: 'model', text: first.text },
        { role: 'user', text: correctionInstruction(parsed.detail) },
      ]);
      inputTokens += second.inputTokens;
      outputTokens += second.outputTokens;
      if (!second.ok) {
        return { ok: false, error: second.error, message: second.message, provenance: provenance() };
      }
      parsed = parseStructured(second.text, schema);
    }

    if (!parsed.ok) {
      return {
        ok: false,
        error: AI_ERROR_CODES.AI_INVALID_OUTPUT,
        message: `Model output did not match the required schema: ${parsed.detail}`,
        provenance: provenance(),
      };
    }
    return { ok: true, data: parsed.data, provenance: provenance() };
  }
}
