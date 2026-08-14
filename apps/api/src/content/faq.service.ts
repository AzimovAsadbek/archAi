import { type FaqListResponse, type Paginated } from '@archai/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../admin/admin.constants';
import { AuditService } from '../admin/audit.service';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import {
  type AdminFaqItemDto,
  type CreateFaqInput,
  type ListAdminFaqQuery,
  type UpdateFaqInput,
} from './content.schema';
import { toAdminFaqItemDto, toFaqItemDto } from './content.mappers';

/** FAQ reads (public) and CRUD (admin). Content is global — never owner-scoped. */
@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public: published items only, grouped by category then sort order. */
  async listPublished(): Promise<FaqListResponse> {
    const rows = await this.prisma.faqItem.findMany({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { items: rows.map(toFaqItemDto) };
  }

  /** Admin: everything incl. unpublished. One `faq.list` audit row per request. */
  async listAll(actorId: string, query: ListAdminFaqQuery): Promise<Paginated<AdminFaqItemDto>> {
    const where: Prisma.FaqItemWhereInput = {
      ...(query.category ? { category: query.category } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.faqItem.count({ where }),
      this.prisma.faqItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    await this.audit.record(actorId, AUDIT_ACTIONS.faqList, AUDIT_ENTITIES.faq, null, {
      total,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.category ? { category: query.category } : {}),
    });

    return { items: rows.map(toAdminFaqItemDto), total, page: query.page, pageSize: query.pageSize };
  }

  async create(actorId: string, input: CreateFaqInput): Promise<AdminFaqItemDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.faqItem.create({
        data: {
          question: input.question,
          answer: input.answer,
          category: input.category ?? null,
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isPublished === undefined ? {} : { isPublished: input.isPublished }),
        },
      });
      await this.audit.record(actorId, AUDIT_ACTIONS.faqCreate, AUDIT_ENTITIES.faq, row.id, {
        category: row.category,
      });
      return row;
    });
    return toAdminFaqItemDto(created);
  }

  async update(actorId: string, id: string, input: UpdateFaqInput): Promise<AdminFaqItemDto> {
    await this.requireFaq(id);

    const data: Prisma.FaqItemUpdateInput = {};
    if (input.question !== undefined) data.question = input.question;
    if (input.answer !== undefined) data.answer = input.answer;
    if (input.category !== undefined) data.category = input.category ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isPublished !== undefined) data.isPublished = input.isPublished;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.faqItem.update({ where: { id }, data });
      await this.audit.record(actorId, AUDIT_ACTIONS.faqUpdate, AUDIT_ENTITIES.faq, id, {
        isPublished: row.isPublished,
      });
      return row;
    });
    return toAdminFaqItemDto(updated);
  }

  async remove(actorId: string, id: string): Promise<void> {
    await this.requireFaq(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.faqItem.delete({ where: { id } });
      await this.audit.record(actorId, AUDIT_ACTIONS.faqDelete, AUDIT_ENTITIES.faq, id);
    });
  }

  private async requireFaq(id: string): Promise<void> {
    const exists = await this.prisma.faqItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'FAQ item not found' });
    }
  }
}
