import { type ProjectProposal } from './schemas/proposal.schema';
import { type SuggestionsOutput } from './schemas/suggestions.schema';
import { type AnswerOutput } from './schemas/answer.schema';

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
 * Compact, trusted view of an already-configured project, assembled by the API
 * from persisted data. It is the grounding context for the assistant operations
 * and is kept small on purpose (free-tier token budget, §23). Dimensions are
 * metres; a null block means that part is not configured yet.
 */
export interface ProjectContext {
  name: string | null;
  land: { areaM2: number; widthM: number | null; lengthM: number | null } | null;
  house: { widthM: number; lengthM: number; floorCount: number; style: string | null } | null;
  rooms: {
    type: string;
    floor: number;
    widthM: number | null;
    lengthM: number | null;
    label: string | null;
  }[];
  features: { garage: boolean; terrace: boolean; balcony: boolean; pool: boolean; garden: boolean };
}

export interface SuggestInput {
  project: ProjectContext;
  /** Optional user steer ("focus on the kitchen"). Untrusted — data, not instructions. */
  focus?: string;
  localeHint?: LocaleHint;
}

export type SuggestResult =
  | { ok: true; suggestions: SuggestionsOutput; provenance: AiProvenance }
  | { ok: false; error: AiErrorCode; message: string; provenance?: AiProvenance };

export interface QuestionInput {
  project: ProjectContext;
  /** The user's question about their project. Untrusted — data, not instructions. */
  question: string;
  localeHint?: LocaleHint;
}

export type AnswerResult =
  | { ok: true; answer: AnswerOutput; provenance: AiProvenance }
  | { ok: false; error: AiErrorCode; message: string; provenance?: AiProvenance };

/**
 * The only surface applications talk to. Every operation is provider-agnostic:
 * a request never learns whether Gemini, Groq or a mock answered. Providers never
 * throw — every failure is a `{ ok: false }` result with a stable `AiErrorCode`.
 */
export interface ArchitectureAIProvider {
  /** 'gemini' | 'groq' | 'mock' | 'unconfigured'. */
  readonly name: string;
  /** Free text → a reviewable project proposal (used at project creation). */
  parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult>;
  /** An existing project → advisory design suggestions the user reviews. */
  suggestImprovements(input: SuggestInput): Promise<SuggestResult>;
  /** A grounded answer to a question about an existing project. */
  answerQuestion(input: QuestionInput): Promise<AnswerResult>;
}
