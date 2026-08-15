import {
  type AiErrorCode,
  type AiProvenance,
  type ArchitectureAIProvider,
  type ProjectContext,
  PARSE_PROJECT_PROMPT_VERSION,
} from '@archai/ai';
import { validateProjectConfiguration } from '@archai/shared';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type AiGenerationKind, type AiGenerationStatus } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ARCHITECTURE_AI_PROVIDER } from './ai.constants';
import { toAiHttpException } from './ai.errors';
import { resolveAiWiring } from './ai.wiring';
import {
  type AnswerResponseDto,
  type AskRequestInput,
  type ParseProjectRequestInput,
  type ParseProjectResponseDto,
  type SuggestRequestInput,
  type SuggestResponseDto,
} from './ai.schema';
import { sanitizeProposal } from './proposal.sanitizer';

/** Safe, secrets-free view of runtime AI wiring for the product UI and admin. */
export interface AiStatusDto {
  provider: string;
  available: boolean;
  fallbackProvider: string | null;
  fallbackAvailable: boolean;
  primaryModel: string;
  dailyRequestLimitPerUser: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(ARCHITECTURE_AI_PROVIDER) private readonly provider: ArchitectureAIProvider,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Turns a free-text request into a reviewable proposal. The AI proposes, the
   * shared schemas and domain rules validate, and the user decides — nothing is
   * written to the project tables here. A per-user daily quota runs first so one
   * account cannot drain the shared free-tier provider budget.
   */
  async parseProject(
    userId: string,
    input: ParseProjectRequestInput,
  ): Promise<ParseProjectResponseDto> {
    await this.enforceDailyQuota(userId);

    const result = await this.provider.parseProjectRequest({
      text: input.text,
      localeHint: input.localeHint,
    });

    if (!result.ok) {
      // The provider message is a server-side diagnostic (never user text); the
      // client only ever sees the stable code.
      this.logger.error(`parse-project failed [${result.error}] ${result.message}`);
      await this.record(userId, 'PARSE_PROJECT', 'FAILED', result.provenance, result.error);
      throw toAiHttpException(result.error);
    }

    const { proposal, configuration } = sanitizeProposal(result.proposal);
    const validation = validateProjectConfiguration(configuration);
    await this.record(userId, 'PARSE_PROJECT', 'SUCCEEDED', result.provenance);

    return { proposal, validation, provenance: result.provenance };
  }

  /**
   * Advisory design suggestions for an existing, owned project. The project is
   * loaded server-side from its id (never trusted from the client), summarised
   * into a compact context, and the model returns suggestions the user reviews
   * and applies by hand — nothing here mutates the project.
   */
  async suggestImprovements(
    userId: string,
    projectId: string,
    input: SuggestRequestInput,
  ): Promise<SuggestResponseDto> {
    await this.enforceDailyQuota(userId);
    const project = await this.loadProjectContext(userId, projectId);

    const result = await this.provider.suggestImprovements({
      project,
      focus: input.focus,
      localeHint: input.localeHint,
    });

    if (!result.ok) {
      this.logger.error(`suggest-improvements failed [${result.error}] ${result.message}`);
      await this.record(userId, 'SUGGEST_IMPROVEMENTS', 'FAILED', result.provenance, result.error);
      throw toAiHttpException(result.error);
    }

    await this.record(userId, 'SUGGEST_IMPROVEMENTS', 'SUCCEEDED', result.provenance);
    return { suggestions: result.suggestions, provenance: result.provenance };
  }

  /**
   * Answers a question about an existing, owned project, grounded in its data.
   * Off-topic, out-of-scope or injection questions come back with
   * `answer.addressable === false` and a safe redirect — never a leak.
   */
  async answerQuestion(
    userId: string,
    projectId: string,
    input: AskRequestInput,
  ): Promise<AnswerResponseDto> {
    await this.enforceDailyQuota(userId);
    const project = await this.loadProjectContext(userId, projectId);

    const result = await this.provider.answerQuestion({
      project,
      question: input.question,
      localeHint: input.localeHint,
    });

    if (!result.ok) {
      this.logger.error(`answer-question failed [${result.error}] ${result.message}`);
      await this.record(userId, 'ANSWER_QUESTION', 'FAILED', result.provenance, result.error);
      throw toAiHttpException(result.error);
    }

    await this.record(userId, 'ANSWER_QUESTION', 'SUCCEEDED', result.provenance);
    return { answer: result.answer, provenance: result.provenance };
  }

  /** Configuration-derived AI status; carries no secrets. */
  getStatus(): AiStatusDto {
    const wiring = resolveAiWiring(this.config);
    return {
      provider: wiring.provider,
      available: this.provider.name !== 'unconfigured',
      fallbackProvider: wiring.fallbackProvider === 'none' ? null : wiring.fallbackProvider,
      fallbackAvailable: wiring.fallbackAvailable,
      primaryModel: wiring.primaryModel,
      dailyRequestLimitPerUser: wiring.dailyRequestLimitPerUser,
    };
  }

  /**
   * Loads an owned, non-deleted project and reduces it to the compact
   * `ProjectContext` the assistant reasons over. Cross-user or missing ids are a
   * 404 (no existence leak), exactly like every other project-scoped route.
   */
  private async loadProjectContext(userId: string, projectId: string): Promise<ProjectContext> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId, deletedAt: null },
      include: { rooms: { orderBy: [{ floor: 'asc' }, { sortOrder: 'asc' }] } },
    });

    if (!project) {
      throw new HttpException(
        { code: ERROR_CODES.NOT_FOUND, message: 'Project not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      name: project.name,
      land:
        project.landAreaM2 != null
          ? { areaM2: project.landAreaM2, widthM: project.landWidthM, lengthM: project.landLengthM }
          : null,
      house:
        project.houseWidthM != null && project.houseLengthM != null && project.floorCount != null
          ? {
              widthM: project.houseWidthM,
              lengthM: project.houseLengthM,
              floorCount: project.floorCount,
              style: project.style,
            }
          : null,
      rooms: project.rooms.map((room) => ({
        type: room.type,
        floor: room.floor,
        widthM: room.widthM,
        lengthM: room.lengthM,
        label: room.label,
      })),
      features: {
        garage: project.hasGarage,
        terrace: project.hasTerrace,
        balcony: project.hasBalcony,
        pool: project.hasPool,
        garden: project.hasGarden,
      },
    };
  }

  /**
   * App-level quota, counted over the current UTC day from the same provenance
   * rows `record` writes. It sits in front of the provider so a rejected request
   * never reaches a paid/free-tier API and never records a row of its own.
   */
  private async enforceDailyQuota(userId: string): Promise<void> {
    const limit = this.config.aiMaxRequestsPerUserPerDay;
    if (limit <= 0) return;

    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const used = await this.prisma.aiGeneration.count({
      where: { userId, createdAt: { gte: since } },
    });

    if (used >= limit) {
      throw new HttpException(
        {
          code: ERROR_CODES.AI_QUOTA_EXCEEDED,
          message: 'Daily AI request limit reached — please try again tomorrow',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Appends one provenance row. It holds no request text, prompt or output — only
   * who called, what answered and how it went. A failure to write is logged and
   * swallowed: the audit trail must never cost the user their answer.
   */
  private async record(
    userId: string,
    kind: AiGenerationKind,
    status: AiGenerationStatus,
    provenance: AiProvenance | undefined,
    errorCode?: AiErrorCode,
  ): Promise<void> {
    const run = provenance ?? this.unknownProvenance();
    try {
      await this.prisma.aiGeneration.create({
        data: {
          userId,
          kind,
          provider: run.provider,
          model: run.model,
          promptVersion: run.promptVersion,
          status,
          errorCode: errorCode ?? null,
          inputTokens: run.inputTokens ?? null,
          outputTokens: run.outputTokens ?? null,
          durationMs: Math.round(run.durationMs),
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to record AI provenance',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Used only when a provider reports a failure without provenance. */
  private unknownProvenance(): AiProvenance {
    return {
      provider: this.provider.name,
      model: 'unknown',
      promptVersion: PARSE_PROJECT_PROMPT_VERSION,
      durationMs: 0,
    };
  }
}
