import {
  calculateEstimate,
  type EstimateResult,
  type EstimateRules,
  estimateRulesSchema,
  type FinishLevel,
  isConfigurationComplete,
} from '@archai/shared';
import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { type ProjectWithRooms, toProjectConfiguration } from '../projects/project.mapper';

const WITH_SORTED_ROOMS = { rooms: { orderBy: { sortOrder: 'asc' } } } as const;

/** `GET /projects/:id/estimate` response (docs/estimate.md §Persistence & API). */
export interface EstimateDto {
  estimate: EstimateResult;
}

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Preliminary cost estimate for a project. Computed on demand from the active
   * rule set and never persisted, so an administrator's price change takes effect
   * on the next request — and no stale estimate can outlive the prices it used.
   */
  async findOne(
    ownerId: string,
    projectId: string,
    finishLevel: FinishLevel,
  ): Promise<EstimateDto> {
    const project = await this.requireProject(ownerId, projectId);
    const config = toProjectConfiguration(project);
    // `land` and `house` are non-null whenever the configuration is complete —
    // checked for the compiler, so `calculateEstimate` cannot throw below.
    if (!isConfigurationComplete(config) || !config.land || !config.house) {
      throw new ConflictException({
        code: ERROR_CODES.PROJECT_NOT_CONFIGURED,
        message: 'Project configuration is incomplete — land, house and rooms are required',
      });
    }

    const rules = await this.activeRules();
    return { estimate: calculateEstimate(config, rules, finishLevel) };
  }

  /**
   * The one active rule set, re-validated on read: stored JSON is data an admin
   * can edit, so it is never trusted to still match the schema. Anything wrong
   * with it is a deployment problem, not a user error — no partial estimate is
   * ever returned.
   */
  private async activeRules(): Promise<EstimateRules> {
    const row = await this.prisma.estimateRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (row === null) {
      throw this.rulesUnavailable('no active row in estimate_rules — run the database seed');
    }

    const parsed = estimateRulesSchema.safeParse(row.data);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw this.rulesUnavailable(
        `active estimate_rules row ${row.id} (version ${row.version}) failed validation — ${issues}`,
      );
    }
    return parsed.data;
  }

  /**
   * Logged with `ESTIMATE_RULES_MISSING` and the concrete reason; the client only
   * ever sees the generic 500 the exception filter renders — a misconfigured
   * price table must not describe the server's internals to a user.
   */
  private rulesUnavailable(reason: string): HttpException {
    this.logger.error(`${ERROR_CODES.ESTIMATE_RULES_MISSING}: ${reason}`);
    return new InternalServerErrorException({
      code: ERROR_CODES.ESTIMATE_RULES_MISSING,
      message: 'Estimate rules are unavailable',
    });
  }

  /** Owner-scoped lookup; anything else (missing or foreign) is a 404. */
  private async requireProject(ownerId: string, id: string): Promise<ProjectWithRooms> {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: WITH_SORTED_ROOMS,
    });
    if (!project) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Project not found',
      });
    }
    return project;
  }
}
