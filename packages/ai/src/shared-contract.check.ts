import {
  type AiAnswerOutput as SharedAiAnswerOutput,
  type AiProvenance as SharedAiProvenance,
  type AiSuggestionsOutput as SharedAiSuggestionsOutput,
  type ProjectProposal as SharedProjectProposal,
} from '@archai/shared';
import { type AnswerOutput } from './schemas/answer.schema';
import { type ProjectProposal } from './schemas/proposal.schema';
import { type SuggestionsOutput } from './schemas/suggestions.schema';
import { type AiProvenance } from './types';

/**
 * Compile-time two-way assignability between this package's runtime contracts
 * and the transport types in @archai/shared (which apps/web consumes without
 * pulling in a provider SDK). If either side drifts, typecheck fails here.
 */
type AssertMutual<A, B> = A extends B ? (B extends A ? true : never) : never;

export type _ProposalContractHolds = AssertMutual<ProjectProposal, SharedProjectProposal>;
export type _ProvenanceContractHolds = AssertMutual<AiProvenance, SharedAiProvenance>;
export type _SuggestionsContractHolds = AssertMutual<SuggestionsOutput, SharedAiSuggestionsOutput>;
export type _AnswerContractHolds = AssertMutual<AnswerOutput, SharedAiAnswerOutput>;

const _proposalOk: _ProposalContractHolds = true;
const _provenanceOk: _ProvenanceContractHolds = true;
const _suggestionsOk: _SuggestionsContractHolds = true;
const _answerOk: _AnswerContractHolds = true;
void _proposalOk;
void _provenanceOk;
void _suggestionsOk;
void _answerOk;
