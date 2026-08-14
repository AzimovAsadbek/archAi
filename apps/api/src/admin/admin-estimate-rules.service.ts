import { type EstimateRules, type Paginated } from '@archai/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from './admin.constants';
import { type AdminEstimateRuleDto, type ListEstimateRulesQuery } from './admin.schema';
import { AuditService } from './audit.service';

@Injectable()
export class AdminEstimateRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Version history, newest first. Prices are not user data — no audit row. */
  async list(query: ListEstimateRulesQuery): Promise<Paginated<AdminEstimateRuleDto>> {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.estimateRule.count(),
      this.prisma.estimateRule.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(toAdminEstimateRuleDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Publishes a new rule set and makes it the active one. Prices are never
   * edited in place: every change is a new immutable version, so any estimate can
   * still be traced back to the numbers that produced it.
   */
  async create(actorId: string, input: EstimateRules): Promise<AdminEstimateRuleDto> {
    const duplicate = await this.prisma.estimateRule.findFirst({
      where: { version: input.version },
      select: { id: true },
    });
    if (duplicate) {
      throw this.versionExists(input.version);
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.estimateRule.findFirst({
          where: { isActive: true },
          select: { version: true },
        });
        // Deactivate first: the partial unique index allows exactly one active row,
        // so the insert below must never overlap with the outgoing version.
        await tx.estimateRule.updateMany({ where: { isActive: true }, data: { isActive: false } });
        const row = await tx.estimateRule.create({
          data: { version: input.version, data: input, isActive: true },
        });
        await this.audit.record(
          actorId,
          AUDIT_ACTIONS.estimateRulesActivate,
          AUDIT_ENTITIES.estimateRule,
          row.id,
          { version: row.version, previousVersion: previous?.version ?? null },
          tx,
        );
        return row;
      });

      return toAdminEstimateRuleDto(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Two administrators publishing at once — one loses the active-row index.
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: 'Another rule set was activated at the same time — reload and retry',
        });
      }
      throw error;
    }
  }

  private versionExists(version: string): ConflictException {
    return new ConflictException({
      code: ERROR_CODES.VERSION_EXISTS,
      message: `Estimate rules version "${version}" already exists`,
    });
  }
}

function toAdminEstimateRuleDto(row: {
  id: string;
  version: string;
  isActive: boolean;
  createdAt: Date;
  data: Prisma.JsonValue;
}): AdminEstimateRuleDto {
  return {
    id: row.id,
    version: row.version,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    data: row.data,
  };
}
