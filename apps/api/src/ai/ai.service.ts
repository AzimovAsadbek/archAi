import {
  type AiErrorCode,
  type AiProvenance,
  type ArchitectureAIProvider,
  PARSE_PROJECT_PROMPT_VERSION,
} from '@archai/ai';
import { validateProjectConfiguration } from '@archai/shared';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type AiGenerationStatus } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ARCHITECTURE_AI_PROVIDER } from './ai.constants';
import { toAiHttpException } from './ai.errors';
import { resolveAiWiring } from './ai.wiring';
import { type ParseProjectRequestInput, type ParseProjectResponseDto } from './ai.schema';
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
      await this.record(userId, 'FAILED', result.provenance, result.error);
      throw toAiHttpException(result.error);
    }

    const { proposal, configuration } = sanitizeProposal(result.proposal);
    const validation = validateProjectConfiguration(configuration);
    await this.record(userId, 'SUCCEEDED', result.provenance);

    return { proposal, validation, provenance: result.provenance };
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
    status: AiGenerationStatus,
    provenance: AiProvenance | undefined,
    errorCode?: AiErrorCode,
  ): Promise<void> {
    const run = provenance ?? this.unknownProvenance();
    try {
      await this.prisma.aiGeneration.create({
        data: {
          userId,
          kind: 'PARSE_PROJECT',
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
