import { projectProposalSchema, type ProjectProposal } from '../schemas/proposal.schema';
import { parseStructured } from './structured-output';

// Re-exported so existing importers keep a stable path; the implementations now
// live in the provider-agnostic structured-output core.
export { correctionInstruction, formatIssues } from './structured-output';

export type ProposalParse =
  | { ok: true; proposal: ProjectProposal }
  | { ok: false; kind: 'not_json' | 'schema'; detail: string };

/**
 * Proposal-specific wrapper over the generic structured-output parser: same
 * `not_json` / `schema` / `detail` contract, specialised to the proposal shape.
 */
export function parseProposal(text: string): ProposalParse {
  const parsed = parseStructured(text, projectProposalSchema);
  return parsed.ok ? { ok: true, proposal: parsed.data } : parsed;
}
