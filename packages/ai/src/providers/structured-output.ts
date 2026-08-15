import { type ZodError, type ZodType } from 'zod';

/**
 * Result of turning raw model text into a validated value. `not_json` means the
 * output was not JSON at all; `schema` means it was JSON but violated the target
 * shape or bounds. `detail` is a compact, structural description — the Zod
 * messages are our own snake_case keys (e.g. `land_area_min`) or field paths,
 * never user text — safe to feed back to the model for one correction pass.
 *
 * This is the provider-agnostic core reused by every structured AI operation
 * (parse, suggest, answer): each supplies its own Zod schema and the pipeline is
 * identical, so a new operation never re-implements parsing, correction or bounds.
 */
export type StructuredParse<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'not_json' | 'schema'; detail: string };

/** Strips code fences some models wrap JSON in despite being asked for raw JSON. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export function parseStructured<T>(text: string, schema: ZodType<T>): StructuredParse<T> {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(text));
  } catch {
    return { ok: false, kind: 'not_json', detail: 'output was not valid JSON' };
  }

  const result = schema.safeParse(json);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, kind: 'schema', detail: formatIssues(result.error) };
}

/** Compact `path: message` list, capped so a pathological error stays bounded. */
export function formatIssues(error: ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/**
 * The user-turn text for the single correction attempt (§21). It names what was
 * wrong structurally without re-stating rules the system prompt already carries.
 */
export function correctionInstruction(detail: string): string {
  return `Your previous JSON did not satisfy the required schema: ${detail}. Return a corrected JSON object that fixes exactly these problems and still follows every earlier rule. Output only the JSON object, nothing else.`;
}

/**
 * Output-format block appended to a system prompt for JSON-mode providers (both
 * Gemini and Groq). Neither relies on native schema enforcement — Gemini's
 * constrained decoder rejects parts of this JSON Schema and Groq's `json_object`
 * enforces none of it — so the model is shown the exact shape here and Zod
 * re-checks it. One portable pipeline, any schema.
 */
export function jsonSchemaInstruction(schema: object): string {
  return `\n\n# Output format\nRespond with ONLY a single JSON object — no markdown fences, no commentary. It must conform exactly to this JSON Schema (every "required" key present, no extra keys):\n${JSON.stringify(schema, null, 2)}`;
}
