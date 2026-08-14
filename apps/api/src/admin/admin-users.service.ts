import { type Paginated } from '@archai/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { TokenService } from '../auth/token.service';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from './admin.constants';
import {
  type AdminUserListItemDto,
  type ListAdminUsersQuery,
  type UpdateAdminUserInput,
} from './admin.schema';
import { AuditService } from './audit.service';

/** Soft-deleted projects are gone from the user's perspective — and from the count. */
const WITH_COUNTS = {
  _count: {
    select: {
      projects: { where: { deletedAt: null } },
      aiGenerations: true,
    },
  },
} as const;

type UserRow = Prisma.UserGetPayload<{ include: typeof WITH_COUNTS }>;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokens: TokenService,
  ) {}

  /** Cross-user read: one `users.list` audit row per request, whatever the filters. */
  async list(actorId: string, query: ListAdminUsersQuery): Promise<Paginated<AdminUserListItemDto>> {
    const where: Prisma.UserWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: WITH_COUNTS,
      }),
    ]);

    await this.audit.record(actorId, AUDIT_ACTIONS.usersList, AUDIT_ENTITIES.user, null, {
      total,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search ? { search: query.search } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    });

    return {
      items: rows.map(toAdminUserListItemDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Flips `isActive`. Deactivation also revokes every refresh token in the same
   * transaction, so the account cannot outlive the decision by one rotation;
   * reactivation only lifts the flag — killed sessions stay killed.
   */
  async setActive(
    actorId: string,
    targetId: string,
    input: UpdateAdminUserInput,
  ): Promise<AdminUserListItemDto> {
    if (targetId === actorId) {
      // Checked before the role rule: the clearer error for the likelier mistake.
      throw new ConflictException({
        code: ERROR_CODES.CANNOT_MODIFY_SELF,
        message: 'You cannot change your own account status',
      });
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found' });
    }
    if (target.role === 'ADMIN') {
      throw new ConflictException({
        code: ERROR_CODES.CANNOT_MODIFY_ADMIN,
        message: 'Another administrator cannot be modified from the admin panel',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id: targetId },
        data: { isActive: input.isActive },
        include: WITH_COUNTS,
      });
      if (!input.isActive) {
        await this.tokens.revokeAllForUser(targetId, tx);
      }
      await this.audit.record(
        actorId,
        input.isActive ? AUDIT_ACTIONS.userActivate : AUDIT_ACTIONS.userDeactivate,
        AUDIT_ENTITIES.user,
        targetId,
        { email: row.email },
        tx,
      );
      return row;
    });

    return toAdminUserListItemDto(updated);
  }
}

function toAdminUserListItemDto(user: UserRow): AdminUserListItemDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    projectCount: user._count.projects,
    aiGenerationCount: user._count.aiGenerations,
  };
}
