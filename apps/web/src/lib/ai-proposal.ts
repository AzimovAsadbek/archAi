import {
  DOMAIN_ISSUES,
  validateProjectConfiguration,
  type AiProposalFeatures,
  type DomainIssue,
  type DomainIssueCode,
  type DomainValidationResult,
  type FeaturesConfig,
  type ProjectConfiguration,
  type ProjectProposal,
  type UpdateProjectInput,
} from '@archai/shared';
import { ApiError } from './api';
import { FEATURE_KEYS } from './project-options';

/**
 * Notes the API appended itself carry this prefix, so they stay distinguishable
 * from the model's own assumptions (docs/ai-architecture.md).
 */
export const SERVER_NOTE_PREFIX = '[server]';

export interface ProposalAssumption {
  text: string;
  /** A server note (English, technical) rather than a model guess in the user's language. */
  fromServer: boolean;
}

export function readAssumption(raw: string): ProposalAssumption {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(SERVER_NOTE_PREFIX)) return { text: trimmed, fromServer: false };
  return { text: trimmed.slice(SERVER_NOTE_PREFIX.length).trim(), fromServer: true };
}

/** Configuration blocks a proposal can carry — the unit we keep or drop. */
export const PROPOSAL_BLOCKS = ['land', 'house', 'rooms'] as const;
export type ProposalBlock = (typeof PROPOSAL_BLOCKS)[number];

/**
 * `null` means "the user never mentioned it", so it must not become `false`:
 * only explicitly stated features are sent, and the unstated ones keep the
 * project defaults (all false) without the proposal claiming anything.
 */
export function proposalFeaturesPatch(features: AiProposalFeatures): Partial<FeaturesConfig> {
  const patch: Partial<FeaturesConfig> = {};
  for (const key of FEATURE_KEYS) {
    const value = features[key];
    if (typeof value === 'boolean') patch[key] = value;
  }
  return patch;
}

/** The proposal seen as a project configuration, minus the dropped blocks. */
export function proposalConfiguration(
  proposal: ProjectProposal,
  dropped: ReadonlySet<ProposalBlock> = new Set(),
): ProjectConfiguration {
  return {
    land: dropped.has('land') ? null : proposal.land,
    house: dropped.has('house') ? null : proposal.house,
    rooms: dropped.has('rooms') ? [] : proposal.rooms,
    features: proposalFeaturesPatch(proposal.features),
  };
}

/**
 * Which block an error blames. House/land conflicts are resolved by dropping
 * the house (the land is still a fact about the plot); room errors only exist
 * relative to a house, so dropping the rooms clears them.
 */
const BLOCK_BY_ISSUE: Record<DomainIssueCode, ProposalBlock | null> = {
  [DOMAIN_ISSUES.HOUSE_EXCEEDS_LAND]: 'house',
  [DOMAIN_ISSUES.HOUSE_WIDTH_EXCEEDS_LAND]: 'house',
  [DOMAIN_ISSUES.HOUSE_LENGTH_EXCEEDS_LAND]: 'house',
  [DOMAIN_ISSUES.ROOM_ON_MISSING_FLOOR]: 'rooms',
  [DOMAIN_ISSUES.FLOOR_AREA_EXCEEDED]: 'rooms',
  // Warnings never block an apply.
  [DOMAIN_ISSUES.HIGH_LAND_COVERAGE]: null,
  [DOMAIN_ISSUES.LAND_DIMENSIONS_MISMATCH]: null,
  [DOMAIN_ISSUES.FLOOR_NEARLY_FULL]: null,
  [DOMAIN_ISSUES.MISSING_KITCHEN]: null,
  [DOMAIN_ISSUES.MISSING_BATHROOM]: null,
  [DOMAIN_ISSUES.NO_ROOMS]: null,
};

function collectBlocks(errors: readonly DomainIssue[], into: Set<ProposalBlock>): void {
  for (const issue of errors) {
    const block = BLOCK_BY_ISSUE[issue.code as DomainIssueCode] ?? null;
    if (block !== null) into.add(block);
  }
}

/**
 * The smallest set of blocks whose removal makes the proposal applicable.
 * Starts from the server's verdict and re-checks locally with the same shared
 * rules, so PATCH never receives a configuration the API would refuse.
 */
export function blocksToDrop(
  proposal: ProjectProposal,
  validation: DomainValidationResult,
): Set<ProposalBlock> {
  const dropped = new Set<ProposalBlock>();
  collectBlocks(validation.errors, dropped);

  // One pass per droppable block is enough to reach a fixed point.
  for (let round = 0; round < PROPOSAL_BLOCKS.length; round += 1) {
    const result = validateProjectConfiguration(proposalConfiguration(proposal, dropped));
    if (result.errors.length === 0) break;
    const before = dropped.size;
    collectBlocks(result.errors, dropped);
    if (dropped.size === before) break;
  }

  return dropped;
}

/**
 * Proposal → `PATCH /projects/:id` body. Blocks the proposal does not carry (or
 * that were dropped) are omitted rather than nulled, so the patch only ever
 * states what the AI actually proposed.
 */
export function proposalToUpdateInput(
  proposal: ProjectProposal,
  dropped: ReadonlySet<ProposalBlock> = new Set(),
): UpdateProjectInput {
  const patch: UpdateProjectInput = {};

  if (proposal.land !== null && !dropped.has('land')) {
    patch.land = {
      areaM2: proposal.land.areaM2,
      widthM: proposal.land.widthM,
      lengthM: proposal.land.lengthM,
    };
  }

  if (proposal.house !== null && !dropped.has('house')) {
    patch.house = {
      widthM: proposal.house.widthM,
      lengthM: proposal.house.lengthM,
      floorCount: proposal.house.floorCount,
      style: proposal.house.style,
    };
  }

  if (proposal.rooms.length > 0 && !dropped.has('rooms')) {
    patch.rooms = proposal.rooms.map((room) => ({
      type: room.type,
      floor: room.floor,
      widthM: room.widthM,
      lengthM: room.lengthM,
      label: room.label,
    }));
  }

  const features = proposalFeaturesPatch(proposal.features);
  if (Object.keys(features).length > 0) patch.features = features;

  return patch;
}

/** True when the patch would not change anything, so the request can be skipped. */
export function isEmptyPatch(patch: UpdateProjectInput): boolean {
  return Object.keys(patch).length === 0;
}

interface DomainErrorDetails {
  errors?: unknown;
  warnings?: unknown;
}

function isDomainIssue(value: unknown): value is DomainIssue {
  if (typeof value !== 'object' || value === null) return false;
  const issue = value as Record<string, unknown>;
  return typeof issue.code === 'string' && typeof issue.message === 'string';
}

function issueList(value: unknown): DomainIssue[] {
  return Array.isArray(value) ? value.filter(isDomainIssue) : [];
}

/**
 * Domain issues carried by a 422 `DOMAIN_VALIDATION_ERROR` from PATCH, so an
 * apply that the server refuses is explained with the same panel as everywhere
 * else instead of a bare error sentence.
 */
export function readDomainValidationError(error: unknown): DomainValidationResult | null {
  if (!(error instanceof ApiError) || error.code !== 'DOMAIN_VALIDATION_ERROR') return null;
  const details = (error.details ?? {}) as DomainErrorDetails;
  const errors = issueList(details.errors);
  const warnings = issueList(details.warnings);
  if (errors.length === 0 && warnings.length === 0) return null;
  return { valid: errors.length === 0, errors, warnings };
}
