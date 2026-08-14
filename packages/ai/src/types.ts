import { type ProjectProposal } from './schemas/proposal.schema';

/**
 * Machine-readable failure reasons. Every provider failure is one of these —
 * providers never throw SDK exceptions at their callers.
 */
export const AI_ERROR_CODES = {
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_REFUSED: 'AI_REFUSED',
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  AI_TIMEOUT: 'AI_TIMEOUT',
} as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

/** UI locale of the caller — a hint only; the model detects the real language. */
export const LOCALE_HINTS = ['uz', 'ru', 'en'] as const;
export type LocaleHint = (typeof LOCALE_HINTS)[number];

export interface ParseProjectInput {
  /** Raw user request. Treated as data, never as instructions. */
  text: string;
  localeHint?: LocaleHint;
}

/** What produced a result — persisted for auditing. Never contains user text. */
export interface AiProvenance {
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
}

export type ParseProjectResult =
  | { ok: true; proposal: ProjectProposal; provenance: AiProvenance }
  | { ok: false; error: AiErrorCode; message: string; provenance?: AiProvenance };

/**
 * The only surface applications talk to. Later slices add `suggestLayout`,
 * `generateExteriorConcept` and `generateInteriorConcept` — they are deliberately
 * absent until they are really implemented.
 */
export interface ArchitectureAIProvider {
  /** 'anthropic' | 'unconfigured' | test fakes. */
  readonly name: string;
  parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult>;
}
