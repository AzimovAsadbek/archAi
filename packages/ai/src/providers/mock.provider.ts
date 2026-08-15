import { PARSE_PROJECT_PROMPT_VERSION } from '../prompts/parse-project';
import { emptyProposal, type ProjectProposal } from '../schemas/proposal.schema';
import {
  type AiProvenance,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
} from '../types';

export interface MockProviderOptions {
  /** Overrides the reported provider name (router tests use several mocks). */
  name?: string;
  model?: string;
  /**
   * Full control for tests: return a fixed result, or compute one per call
   * (e.g. fail the first attempt, succeed on the second). When omitted, the
   * provider echoes a deterministic, schema-valid proposal.
   */
  respond?: (input: ParseProjectInput, callIndex: number) => ParseProjectResult;
}

/**
 * Deterministic in-process provider. It never touches the network, so it backs
 * the shared contract tests, the local no-key path in tests, and router/fallback
 * scenarios (via `respond`). It honours the same never-throw contract as the
 * real providers.
 */
export class MockArchitectureAIProvider implements ArchitectureAIProvider {
  readonly name: string;
  private readonly model: string;
  private readonly respond: MockProviderOptions['respond'];
  private calls = 0;

  constructor(options: MockProviderOptions = {}) {
    this.name = options.name ?? 'mock';
    this.model = options.model ?? 'mock-1';
    this.respond = options.respond;
  }

  parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    const callIndex = this.calls++;
    if (this.respond) return Promise.resolve(this.respond(input, callIndex));

    const proposal: ProjectProposal = {
      ...emptyProposal(input.localeHint ?? 'other'),
      name: input.text.trim().slice(0, 60) || null,
    };
    return Promise.resolve({ ok: true, proposal, provenance: this.provenance(0) });
  }

  private provenance(durationMs: number): AiProvenance {
    return {
      provider: this.name,
      model: this.model,
      promptVersion: PARSE_PROJECT_PROMPT_VERSION,
      inputTokens: 0,
      outputTokens: 0,
      durationMs,
    };
  }
}
