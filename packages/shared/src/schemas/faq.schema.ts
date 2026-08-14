import { z } from 'zod';

/**
 * Public FAQ item (docs/public-content.md §FAQ). `answer` is plain text / light
 * markdown, rendered as paragraphs by the web — never HTML. Shape is the source
 * of truth for both the API response and the web client.
 */
export const faqItemDtoSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  /** Null groups under a catch-all bucket on the web. */
  category: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type FaqItemDto = z.infer<typeof faqItemDtoSchema>;

/** `GET /api/v1/faq` returns published items ordered by (category, sortOrder). */
export const faqListResponseSchema = z.object({
  items: z.array(faqItemDtoSchema),
});
export type FaqListResponse = z.infer<typeof faqListResponseSchema>;
