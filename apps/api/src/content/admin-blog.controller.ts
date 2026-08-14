import { type Paginated } from '@archai/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../admin/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParamPipe } from '../common/pipes/id-param.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AuthenticatedUser } from '../common/types/request.types';
import { BlogService } from './blog.service';
import {
  type AdminBlogPostDto,
  type CreateBlogInput,
  createBlogSchema,
  type ListAdminBlogQuery,
  listAdminBlogQuerySchema,
  type UpdateBlogInput,
  updateBlogSchema,
} from './content.schema';

/**
 * Admin blog CRUD. Behind `AdminGuard`; every route writes an audit row. A publish
 * transition (DRAFT → PUBLISHED) stamps `publishedAt` and logs `blog.publish`.
 */
@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(AdminGuard)
@Controller('admin/blog')
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @ApiOperation({ summary: 'List all posts incl. drafts (records blog.list)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listAdminBlogQuerySchema)) query: ListAdminBlogQuery,
  ): Promise<Paginated<AdminBlogPostDto>> {
    return this.blog.listAll(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a post (409 SLUG_EXISTS on a duplicate slug)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBlogSchema)) body: CreateBlogInput,
  ): Promise<AdminBlogPostDto> {
    return this.blog.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a post; publishing stamps publishedAt',
    description: '404 NOT_FOUND when unknown, 409 SLUG_EXISTS when the new slug is taken.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(updateBlogSchema)) body: UpdateBlogInput,
  ): Promise<AdminBlogPostDto> {
    return this.blog.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete a post (404 NOT_FOUND when unknown)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<void> {
    return this.blog.remove(user.id, id);
  }
}
