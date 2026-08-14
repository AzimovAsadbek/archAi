import {
  type BlogListItemDto,
  type BlogListQuery,
  blogListQuerySchema,
  type BlogPostDto,
  type Paginated,
} from '@archai/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SlugParamPipe } from '../common/pipes/slug-param.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BlogService } from './blog.service';

/** Public blog surface (docs/public-content.md §Blog). Unauthenticated. */
@ApiTags('content')
@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Published blog posts, newest first',
    description:
      'Published posts only, paginated, ordered by publishedAt desc. Optional ' +
      '`category` and `tag` filters. No auth.',
  })
  list(
    @Query(new ZodValidationPipe(blogListQuerySchema)) query: BlogListQuery,
  ): Promise<Paginated<BlogListItemDto>> {
    return this.blog.listPublished(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'A single published post by slug',
    description: 'Body is markdown returned verbatim. Draft or unknown slug → 404. No auth.',
  })
  findOne(@Param('slug', SlugParamPipe) slug: string): Promise<BlogPostDto> {
    return this.blog.findPublishedBySlug(slug);
  }
}
