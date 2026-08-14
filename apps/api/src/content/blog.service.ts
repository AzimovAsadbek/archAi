import {
  type BlogListItemDto,
  type BlogListQuery,
  type BlogPostDto,
  type Paginated,
} from '@archai/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../admin/admin.constants';
import { AuditService } from '../admin/audit.service';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import {
  type AdminBlogPostDto,
  type CreateBlogInput,
  type ListAdminBlogQuery,
  type UpdateBlogInput,
} from './content.schema';
import { toAdminBlogPostDto, toBlogListItemDto, toBlogPostDto } from './content.mappers';

/** Blog reads (public, published-only) and CRUD (admin). Content is global. */
@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public: published posts, newest `publishedAt` first, optional category/tag filter. */
  async listPublished(query: BlogListQuery): Promise<Paginated<BlogListItemDto>> {
    const where: Prisma.BlogPostWhereInput = {
      status: 'PUBLISHED',
      ...(query.category ? { category: query.category } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(toBlogListItemDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Public: a single published post by slug. Drafts and unknown slugs are 404. */
  async findPublishedBySlug(slug: string): Promise<BlogPostDto> {
    const row = await this.prisma.blogPost.findFirst({ where: { slug, status: 'PUBLISHED' } });
    if (!row) {
      throw this.notFound();
    }
    return toBlogPostDto(row);
  }

  /** Admin: every post incl. drafts. One `blog.list` audit row per request. */
  async listAll(actorId: string, query: ListAdminBlogQuery): Promise<Paginated<AdminBlogPostDto>> {
    const where: Prisma.BlogPostWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    await this.audit.record(actorId, AUDIT_ACTIONS.blogList, AUDIT_ENTITIES.blogPost, null, {
      total,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
    });

    return { items: rows.map(toAdminBlogPostDto), total, page: query.page, pageSize: query.pageSize };
  }

  async create(actorId: string, input: CreateBlogInput): Promise<AdminBlogPostDto> {
    await this.assertSlugFree(input.slug);

    const status = input.status ?? 'DRAFT';
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.blogPost.create({
          data: {
            slug: input.slug,
            title: input.title,
            excerpt: input.excerpt,
            body: input.body,
            authorName: input.authorName,
            category: input.category ?? null,
            tags: input.tags ?? [],
            coverImageUrl: input.coverImageUrl ?? null,
            status,
            // A post created straight as PUBLISHED still gets a publish timestamp.
            publishedAt: status === 'PUBLISHED' ? new Date() : null,
            metaTitle: input.metaTitle ?? null,
            metaDescription: input.metaDescription ?? null,
          },
        });
        await this.audit.record(actorId, AUDIT_ACTIONS.blogCreate, AUDIT_ENTITIES.blogPost, row.id, {
          slug: row.slug,
          status: row.status,
        });
        return row;
      });
      return toAdminBlogPostDto(created);
    } catch (error) {
      this.throwIfSlugConflict(error, input.slug);
      throw error;
    }
  }

  async update(actorId: string, id: string, input: UpdateBlogInput): Promise<AdminBlogPostDto> {
    const current = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!current) {
      throw this.notFound();
    }
    if (input.slug !== undefined && input.slug !== current.slug) {
      await this.assertSlugFree(input.slug, id);
    }

    // A publish is DRAFT → PUBLISHED; `publishedAt` is stamped once and never reset.
    const becomingPublished = input.status === 'PUBLISHED' && current.status !== 'PUBLISHED';
    const stampPublishedAt = becomingPublished && current.publishedAt === null;

    const data: Prisma.BlogPostUpdateInput = {};
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.title !== undefined) data.title = input.title;
    if (input.excerpt !== undefined) data.excerpt = input.excerpt;
    if (input.body !== undefined) data.body = input.body;
    if (input.authorName !== undefined) data.authorName = input.authorName;
    if (input.category !== undefined) data.category = input.category ?? null;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl ?? null;
    if (input.status !== undefined) data.status = input.status;
    if (input.metaTitle !== undefined) data.metaTitle = input.metaTitle ?? null;
    if (input.metaDescription !== undefined) data.metaDescription = input.metaDescription ?? null;
    if (stampPublishedAt) data.publishedAt = new Date();

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.blogPost.update({ where: { id }, data });
        await this.audit.record(
          actorId,
          becomingPublished ? AUDIT_ACTIONS.blogPublish : AUDIT_ACTIONS.blogUpdate,
          AUDIT_ENTITIES.blogPost,
          id,
          { slug: row.slug, status: row.status },
        );
        return row;
      });
      return toAdminBlogPostDto(updated);
    } catch (error) {
      this.throwIfSlugConflict(error, input.slug ?? current.slug);
      throw error;
    }
  }

  async remove(actorId: string, id: string): Promise<void> {
    const exists = await this.prisma.blogPost.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw this.notFound();
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.blogPost.delete({ where: { id } });
      await this.audit.record(actorId, AUDIT_ACTIONS.blogDelete, AUDIT_ENTITIES.blogPost, id);
    });
  }

  /** Pre-check for a friendly 409; the unique index is the real guarantee. */
  private async assertSlugFree(slug: string, exceptId?: string): Promise<void> {
    const clash = await this.prisma.blogPost.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) {
      throw this.slugExists(slug);
    }
  }

  /** Turns a unique-constraint race on `slug` into the same 409 as the pre-check. */
  private throwIfSlugConflict(error: unknown, slug: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      (error.meta.target as string[]).includes('slug')
    ) {
      throw this.slugExists(slug);
    }
  }

  private slugExists(slug: string): ConflictException {
    return new ConflictException({
      code: ERROR_CODES.SLUG_EXISTS,
      message: `A blog post with slug "${slug}" already exists`,
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Blog post not found' });
  }
}
