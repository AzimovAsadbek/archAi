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
