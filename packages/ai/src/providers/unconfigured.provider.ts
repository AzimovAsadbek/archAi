import { PARSE_PROJECT_PROMPT_VERSION } from '../prompts/parse-project';
import {
  AI_ERROR_CODES,
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
} from '../types';

/**
 * The provider used when no API key is configured. It fails honestly and
 * immediately instead of pretending AI is available — the API turns this into a
 * 503 and the UI tells the user that an administrator must configure the key.
 */
export class UnconfiguredArchitectureAIProvider implements ArchitectureAIProvider {
  readonly name = 'unconfigured';

  parseProjectRequest(_input: ParseProjectInput): Promise<ParseProjectResult> {
    return Promise.resolve({
      ok: false,
      error: AI_ERROR_CODES.AI_NOT_CONFIGURED,
      message:
        'AI provider is not configured — set the API key for AI_PROVIDER (e.g. GEMINI_API_KEY) on the server',
      provenance: {
        provider: this.name,
        model: 'none',
        promptVersion: PARSE_PROJECT_PROMPT_VERSION,
        durationMs: 0,
      },
    });
  }
}
