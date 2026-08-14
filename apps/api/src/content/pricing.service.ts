import { type Paginated, type PricingResponse } from '@archai/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../admin/admin.constants';
import { AuditService } from '../admin/audit.service';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import {
  type AdminPricingPlanDto,
  type CreatePricingInput,
  type ListAdminPricingQuery,
  type UpdatePricingInput,
} from './content.schema';
import { toAdminPricingPlanDto, toPricingPlanDto } from './content.mappers';

const BY_SORT_ORDER = [{ sortOrder: 'asc' as const }, { priceMonthly: 'asc' as const }];

/** Pricing reads (public) and CRUD (admin). Plans are informational — no billing. */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Public: active plans, ordered. `beta: true` is the honest envelope flag — the
   * product is free during beta and no payment integration exists.
   */
  async listActive(): Promise<PricingResponse> {
    const rows = await this.prisma.pricingPlan.findMany({
      where: { isActive: true },
      orderBy: BY_SORT_ORDER,
    });
    return { plans: rows.map(toPricingPlanDto), beta: true };
  }

  /** Admin: every plan incl. inactive. One `pricing.list` audit row per request. */
  async listAll(
    actorId: string,
    query: ListAdminPricingQuery,
  ): Promise<Paginated<AdminPricingPlanDto>> {
    const where: Prisma.PricingPlanWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.pricingPlan.count({ where }),
      this.prisma.pricingPlan.findMany({
        where,
        orderBy: BY_SORT_ORDER,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    await this.audit.record(
      actorId,
      AUDIT_ACTIONS.pricingList,
      AUDIT_ENTITIES.pricingPlan,
      null,
      {
        total,
        page: query.page,
        pageSize: query.pageSize,
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      },
    );

    return { items: rows.map(toAdminPricingPlanDto), total, page: query.page, pageSize: query.pageSize };
  }

  async create(actorId: string, input: CreatePricingInput): Promise<AdminPricingPlanDto> {
    const clash = await this.prisma.pricingPlan.findUnique({
      where: { key: input.key },
      select: { id: true },
    });
    if (clash) {
      throw this.keyExists(input.key);
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.pricingPlan.create({
          data: {
            key: input.key,
            name: input.name,
            tagline: input.tagline,
            priceMonthly: input.priceMonthly,
            limits: input.limits,
            features: input.features ?? [],
            ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          },
        });
        await this.audit.record(
          actorId,
          AUDIT_ACTIONS.pricingCreate,
          AUDIT_ENTITIES.pricingPlan,
          row.id,
          { key: row.key },
        );
        return row;
      });
      return toAdminPricingPlanDto(created);
    } catch (error) {
      this.throwIfKeyConflict(error, input.key);
      throw error;
    }
  }

  async update(actorId: string, id: string, input: UpdatePricingInput): Promise<AdminPricingPlanDto> {
    await this.requirePlan(id);

    const data: Prisma.PricingPlanUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.tagline !== undefined) data.tagline = input.tagline;
    if (input.priceMonthly !== undefined) data.priceMonthly = input.priceMonthly;
    if (input.limits !== undefined) data.limits = input.limits;
    if (input.features !== undefined) data.features = input.features;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.pricingPlan.update({ where: { id }, data });
      await this.audit.record(
        actorId,
        AUDIT_ACTIONS.pricingUpdate,
        AUDIT_ENTITIES.pricingPlan,
        id,
        { key: row.key },
      );
      return row;
    });
    return toAdminPricingPlanDto(updated);
  }

  /** Plans are never hard-deleted — deactivation hides them from the public list. */
  async deactivate(actorId: string, id: string): Promise<AdminPricingPlanDto> {
    await this.requirePlan(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.pricingPlan.update({ where: { id }, data: { isActive: false } });
      await this.audit.record(
        actorId,
        AUDIT_ACTIONS.pricingDeactivate,
        AUDIT_ENTITIES.pricingPlan,
        id,
        { key: row.key },
      );
      return row;
    });
    return toAdminPricingPlanDto(updated);
  }

  private async requirePlan(id: string): Promise<void> {
    const exists = await this.prisma.pricingPlan.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Pricing plan not found',
      });
    }
  }

  private throwIfKeyConflict(error: unknown, key: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      (error.meta.target as string[]).includes('key')
    ) {
      throw this.keyExists(key);
    }
  }

  private keyExists(key: string): ConflictException {
    return new ConflictException({
      code: ERROR_CODES.CONFLICT,
      message: `A pricing plan with key "${key}" already exists`,
    });
  }
}
