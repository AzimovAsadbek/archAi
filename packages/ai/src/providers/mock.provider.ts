import { PARSE_PROJECT_PROMPT_VERSION } from '../prompts/parse-project';
import { SUGGEST_IMPROVEMENTS_PROMPT_VERSION } from '../prompts/suggest-improvements';
import { ANSWER_QUESTION_PROMPT_VERSION } from '../prompts/answer-question';
import { emptyProposal, type ProjectProposal } from '../schemas/proposal.schema';
import { type AnswerOutput } from '../schemas/answer.schema';
import { type SuggestionsOutput } from '../schemas/suggestions.schema';
import {
  type AiProvenance,
  type AnswerResult,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
  type QuestionInput,
  type SuggestInput,
  type SuggestResult,
} from '../types';

export interface MockProviderOptions {
  /** Overrides the reported provider name (router tests use several mocks). */
  name?: string;
  model?: string;
  /**
   * Full control for tests: return a fixed result, or compute one per call (e.g.
   * fail the first attempt, succeed on the second). When omitted, each operation
   * echoes a deterministic, schema-valid result.
   */
  respond?: (input: ParseProjectInput, callIndex: number) => ParseProjectResult;
  respondSuggest?: (input: SuggestInput, callIndex: number) => SuggestResult;
  respondAnswer?: (input: QuestionInput, callIndex: number) => AnswerResult;
}

/**
 * Deterministic in-process provider. It never touches the network, so it backs
 * the shared contract tests, the local no-key path in tests, and router/fallback
 * scenarios (via the `respond*` hooks). It honours the same never-throw contract
 * as the real providers, for every operation.
 */
export class MockArchitectureAIProvider implements ArchitectureAIProvider {
  readonly name: string;
  private readonly model: string;
  private readonly options: MockProviderOptions;
  private calls = 0;

  constructor(options: MockProviderOptions = {}) {
    this.name = options.name ?? 'mock';
    this.model = options.model ?? 'mock-1';
    this.options = options;
  }

  parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    const callIndex = this.calls++;
    if (this.options.respond) return Promise.resolve(this.options.respond(input, callIndex));

    const proposal: ProjectProposal = {
      ...emptyProposal(input.localeHint ?? 'other'),
      name: input.text.trim().slice(0, 60) || null,
    };
    return Promise.resolve({
      ok: true,
      proposal,
      provenance: this.provenance(PARSE_PROJECT_PROMPT_VERSION),
    });
  }

  suggestImprovements(input: SuggestInput): Promise<SuggestResult> {
    const callIndex = this.calls++;
    if (this.options.respondSuggest) return Promise.resolve(this.options.respondSuggest(input, callIndex));

    const suggestions: SuggestionsOutput = {
      detectedLanguage: input.localeHint ?? 'other',
      summary: 'Deterministic mock assessment.',
      suggestions: [
        {
          category: 'GENERAL',
          title: 'Mock suggestion',
          detail: 'Deterministic mock detail for tests.',
          priority: 'LOW',
        },
      ],
    };
    return Promise.resolve({
      ok: true,
      suggestions,
      provenance: this.provenance(SUGGEST_IMPROVEMENTS_PROMPT_VERSION),
    });
  }

  answerQuestion(input: QuestionInput): Promise<AnswerResult> {
    const callIndex = this.calls++;
    if (this.options.respondAnswer) return Promise.resolve(this.options.respondAnswer(input, callIndex));

    const answer: AnswerOutput = {
      detectedLanguage: input.localeHint ?? 'other',
      addressable: true,
      answer: `Deterministic mock answer (${input.question.trim().slice(0, 80)}).`,
    };
    return Promise.resolve({
      ok: true,
      answer,
      provenance: this.provenance(ANSWER_QUESTION_PROMPT_VERSION),
    });
  }

  private provenance(promptVersion: string): AiProvenance {
    return {
      provider: this.name,
      model: this.model,
      promptVersion,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    };
  }
}
