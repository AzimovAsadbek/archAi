import { z } from 'zod';
import { DETECTED_LANGUAGES } from './proposal.schema';

/** Which aspect of the project a suggestion concerns. */
export const SUGGESTION_CATEGORIES = ['ROOM', 'STYLE', 'FEATURE', 'LAYOUT', 'GENERAL'] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type SuggestionPriority = (typeof SUGGESTION_PRIORITIES)[number];

export const SUGGESTION_LIMITS = {
  maxSuggestions: 8,
  maxTitleChars: 90,
  maxDetailChars: 400,
  maxSummaryChars: 400,
} as const;

/**
 * One advisory suggestion for an existing project. It is text the user reads and
 * acts on manually — never a machine-applied mutation (§25: AI proposes, the user
 * decides). Written in the user's own language.
 */
export const suggestionSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES).describe('Which aspect of the project this concerns.'),
  title: z
    .string()
    .trim()
    .min(1, 'suggestion_title_min')
    .max(SUGGESTION_LIMITS.maxTitleChars, 'suggestion_title_max')
    .describe("Short headline in the user's language."),
  detail: z
    .string()
    .trim()
    .min(1, 'suggestion_detail_min')
    .max(SUGGESTION_LIMITS.maxDetailChars, 'suggestion_detail_max')
    .describe("One-paragraph rationale in the user's language. Advisory only, never a command."),
  priority: z.enum(SUGGESTION_PRIORITIES).describe('How strongly this is recommended.'),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

/**
 * The full advisory response: an overall read plus a bounded list of concrete
 * suggestions. Empty `suggestions` is valid — a complete project needs no advice.
 */
export const suggestionsOutputSchema = z.object({
  detectedLanguage: z.enum(DETECTED_LANGUAGES),
  summary: z
    .string()
    .trim()
    .max(SUGGESTION_LIMITS.maxSummaryChars, 'suggestion_summary_max')
    .nullable()
    .describe("One or two sentences assessing the project overall, in the user's language, or null."),
  suggestions: z
    .array(suggestionSchema)
    .max(SUGGESTION_LIMITS.maxSuggestions, 'too_many_suggestions')
    .describe(
      `Advisory suggestions, at most ${SUGGESTION_LIMITS.maxSuggestions}. Empty when the project already looks complete.`,
    ),
});
export type SuggestionsOutput = z.infer<typeof suggestionsOutputSchema>;

/** JSON Schema shown to json-mode providers; Zod re-validates the reply. */
export const SUGGESTIONS_JSON_SCHEMA = z.toJSONSchema(suggestionsOutputSchema);
