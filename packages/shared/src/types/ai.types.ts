import { type HouseStyle, type RoomType } from '../constants';
import { type DomainValidationResult } from '../domain/validate-project';

/**
 * AI parse-project contract shared between API and web.
 * Source of truth for the runtime schema: packages/ai (zod, structurally
 * asserted against these types at compile time). Web must never import
 * `@archai/ai` — it bundles the server-side provider SDKs (Gemini, Groq).
 */
export interface AiProposalLand {
  areaM2: number;
  widthM: number | null;
  lengthM: number | null;
}

export interface AiProposalHouse {
  widthM: number;
  lengthM: number;
  floorCount: number;
  style: HouseStyle | null;
}

export interface AiProposalRoom {
  type: RoomType;
  floor: number;
  widthM: number | null;
  lengthM: number | null;
  label: string | null;
}

/** `null` means "not mentioned by the user" — never collapse to false when applying. */
export interface AiProposalFeatures {
  garage: boolean | null;
  terrace: boolean | null;
  balcony: boolean | null;
  pool: boolean | null;
  garden: boolean | null;
}

export interface ProjectProposal {
  name: string | null;
  description: string | null;
  land: AiProposalLand | null;
  house: AiProposalHouse | null;
  rooms: AiProposalRoom[];
  features: AiProposalFeatures;
  detectedLanguage: 'uz' | 'ru' | 'en' | 'other';
  /** Model-stated guesses in the user's language; server-added notes are prefixed "[server] ". */
  assumptions: string[];
  /** Requirements the schema cannot express (not silently dropped). */
  unmappable: string[];
}

export interface AiProvenance {
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
}

export interface AiParseProjectResponse {
  proposal: ProjectProposal;
  validation: DomainValidationResult;
  provenance: AiProvenance;
}

// ── Assistant: suggestions + Q&A over an existing project ───────────────────
// Transport mirror of the runtime schemas in packages/ai (asserted equal at
// compile time by @archai/ai's shared-contract check). Web renders these; it
// never imports @archai/ai, which bundles a provider SDK.

export type AiSuggestionCategory = 'ROOM' | 'STYLE' | 'FEATURE' | 'LAYOUT' | 'GENERAL';
export type AiSuggestionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

/** One advisory suggestion the user reads and applies by hand — never auto-applied. */
export interface AiSuggestion {
  category: AiSuggestionCategory;
  title: string;
  detail: string;
  priority: AiSuggestionPriority;
}

export interface AiSuggestionsOutput {
  detectedLanguage: 'uz' | 'ru' | 'en' | 'other';
  summary: string | null;
  suggestions: AiSuggestion[];
}

export interface AiSuggestResponse {
  suggestions: AiSuggestionsOutput;
  provenance: AiProvenance;
}

/** `addressable` is false for off-topic / out-of-scope / injection questions. */
export interface AiAnswerOutput {
  detectedLanguage: 'uz' | 'ru' | 'en' | 'other';
  addressable: boolean;
  answer: string;
}

export interface AiAnswerResponse {
  answer: AiAnswerOutput;
  provenance: AiProvenance;
}
