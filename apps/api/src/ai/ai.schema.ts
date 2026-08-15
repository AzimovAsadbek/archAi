import {
  LOCALE_HINTS,
  type AiProvenance,
  type AnswerOutput,
  type ProjectProposal,
  type SuggestionsOutput,
} from '@archai/ai';
import { type DomainValidationResult } from '@archai/shared';
import { z } from 'zod';
import { AI_FOCUS_TEXT, AI_QUESTION_TEXT, AI_REQUEST_TEXT } from './ai.constants';

/**
 * Request body of `POST /ai/parse-project`. It lives here rather than in
 * `@archai/shared` because nothing outside this endpoint speaks it; the web app
 * only needs the same two bounds, which it gets from the API contract.
 */
export const parseProjectRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(AI_REQUEST_TEXT.min, 'ai_text_min')
    .max(AI_REQUEST_TEXT.max, 'ai_text_max'),
  localeHint: z.enum(LOCALE_HINTS).optional(),
});
export type ParseProjectRequestInput = z.infer<typeof parseProjectRequestSchema>;

/**
 * A proposal the user still has to accept. Nothing here has been persisted:
 * applying it is an explicit `POST /projects` + `PATCH /projects/:id`.
 */
export interface ParseProjectResponseDto {
  proposal: ProjectProposal;
  /** Domain validation of the proposal, computed exactly as for a real project. */
  validation: DomainValidationResult;
  provenance: AiProvenance;
}

/**
 * Body of `POST /ai/projects/:id/suggest`. `focus` is an optional user steer;
 * the project itself is loaded server-side from the id, never sent by the client.
 */
export const suggestRequestSchema = z.object({
  focus: z.string().trim().max(AI_FOCUS_TEXT.max, 'ai_focus_max').optional(),
  localeHint: z.enum(LOCALE_HINTS).optional(),
});
export type SuggestRequestInput = z.infer<typeof suggestRequestSchema>;

export interface SuggestResponseDto {
  suggestions: SuggestionsOutput;
  provenance: AiProvenance;
}

/** Body of `POST /ai/projects/:id/ask`. */
export const askRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(AI_QUESTION_TEXT.min, 'ai_question_min')
    .max(AI_QUESTION_TEXT.max, 'ai_question_max'),
  localeHint: z.enum(LOCALE_HINTS).optional(),
});
export type AskRequestInput = z.infer<typeof askRequestSchema>;

export interface AnswerResponseDto {
  answer: AnswerOutput;
  provenance: AiProvenance;
}
