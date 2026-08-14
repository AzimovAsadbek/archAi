import { type Paginated } from '@archai/shared';
import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from './admin.constants';
import { type AdminProjectListItemDto, type ListAdminProjectsQuery } from './admin.schema';
import { AuditService } from './audit.service';

const WITH_OWNER_AND_COUNT = {
  owner: { select: { email: true } },
  _count: { select: { rooms: true } },
} as const;

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof WITH_OWNER_AND_COUNT }>;

/** Read-only in v1 (docs/admin.md §Backend) — the admin never edits a user's project. */
@Injectable()
export class AdminProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actorId: string,
    query: ListAdminProjectsQuery,
  ): Promise<Paginated<AdminProjectListItemDto>> {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: WITH_OWNER_AND_COUNT,
      }),
    ]);

    await this.audit.record(actorId, AUDIT_ACTIONS.projectsList, AUDIT_ENTITIES.project, null, {
      total,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
    });

    return {
      items: rows.map(toAdminProjectListItemDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}

function toAdminProjectListItemDto(project: ProjectRow): AdminProjectListItemDto {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    ownerEmail: project.owner.email,
    roomCount: project._count.rooms,
    landAreaM2: project.landAreaM2,
    updatedAt: project.updatedAt.toISOString(),
  };
}
