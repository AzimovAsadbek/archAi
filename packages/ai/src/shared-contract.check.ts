import {
  type AiProvenance as SharedAiProvenance,
  type ProjectProposal as SharedProjectProposal,
} from '@archai/shared';
import { type ProjectProposal } from './schemas/proposal.schema';
import { type AiProvenance } from './types';

/**
 * Compile-time two-way assignability between this package's runtime contract
 * and the transport types in @archai/shared (which apps/web consumes without
 * pulling in the Anthropic SDK). If either side drifts, typecheck fails here.
 */
type AssertMutual<A, B> = A extends B ? (B extends A ? true : never) : never;

export type _ProposalContractHolds = AssertMutual<ProjectProposal, SharedProjectProposal>;
export type _ProvenanceContractHolds = AssertMutual<AiProvenance, SharedAiProvenance>;

const _proposalOk: _ProposalContractHolds = true;
const _provenanceOk: _ProvenanceContractHolds = true;
void _proposalOk;
void _provenanceOk;
