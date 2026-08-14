import { z } from 'zod';
import { DEFAULT_PDF_LOCALE, PDF_LOCALES } from './pdf-strings';

/**
 * Query of `GET /projects/:id/export/pdf` — the document language. Uzbek is the
 * product's default, so an absent or unknown-but-omitted param exports in uz;
 * an unsupported value is a 400 VALIDATION_ERROR rather than a silent fallback.
 */
export const pdfExportQuerySchema = z.object({
  locale: z.enum(PDF_LOCALES).default(DEFAULT_PDF_LOCALE),
});

export type PdfExportQuery = z.infer<typeof pdfExportQuerySchema>;
