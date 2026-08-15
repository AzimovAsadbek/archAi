import { type ZodError } from 'zod';
import { projectProposalSchema, type ProjectProposal } from '../schemas/proposal.schema';

export type ProposalParse =
  | { ok: true; proposal: ProjectProposal }
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

/**
 * Parses raw model text into a validated proposal. `not_json` means the output
 * was not JSON at all; `schema` means it was JSON but violated the proposal
 * shape or bounds. `detail` is a compact, structural description — the Zod
 * messages are our own snake_case keys (e.g. `land_area_min`), never user text —
 * safe to feed back to the model for a correction pass.
 */
export function parseProposal(text: string): ProposalParse {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(text));
  } catch {
    return { ok: false, kind: 'not_json', detail: 'output was not valid JSON' };
  }

  const result = projectProposalSchema.safeParse(json);
  if (result.success) return { ok: true, proposal: result.data };
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
