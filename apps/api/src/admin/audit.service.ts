import { type Paginated } from '@archai/shared';
import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type AuditAction, type AuditEntity } from './admin.constants';
import { type AuditLogItemDto, type ListAuditQuery } from './admin.schema';

/**
 * Accepts the plain client or an interactive-transaction client, so a mutation
 * and its audit row are written together or not at all.
 */
export type AuditClient = Pick<PrismaService, 'auditLog'>;

const WITH_ACTOR_EMAIL = { actor: { select: { email: true } } } as const;
type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof WITH_ACTOR_EMAIL }>;

/** Owns `audit_log`: appends the trail and reads it back for `GET /admin/audit`. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends one entry. Callers inside a transaction pass their `tx` client: an
   * audit write that fails must take the mutation down with it, never leave a
   * silent change behind.
   */
  async record(
    actorId: string,
    action: AuditAction,
    entity: AuditEntity,
    entityId?: string | null,
    metadata?: Prisma.InputJsonValue,
    client: AuditClient = this.prisma,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId ?? null,
        ...(metadata === undefined ? {} : { metadata }),
      },
    });
  }

  /** Reading the trail is not a cross-user data bypass, so it is not audited. */
  async list(query: ListAuditQuery): Promise<Paginated<AuditLogItemDto>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: WITH_ACTOR_EMAIL,
      }),
    ]);

    return {
      items: rows.map(toAuditLogItemDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}

function toAuditLogItemDto(row: AuditRow): AuditLogItemDto {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    actorId: row.actorId,
    actorEmail: row.actor?.email ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
