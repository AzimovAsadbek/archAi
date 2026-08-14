import { LOCALE_HINTS, type AiProvenance, type ProjectProposal } from '@archai/ai';
import { type DomainValidationResult } from '@archai/shared';
import { z } from 'zod';
import { AI_REQUEST_TEXT } from './ai.constants';

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
