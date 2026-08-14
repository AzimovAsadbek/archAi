import { type FaqListResponse } from '@archai/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { FaqService } from './faq.service';

/** Public FAQ surface (docs/public-content.md §FAQ). Unauthenticated. */
@ApiTags('content')
@Controller('faq')
export class FaqController {
  constructor(private readonly faq: FaqService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Published FAQ items',
    description: 'Published entries only, ordered by (category, sortOrder). No auth.',
  })
  list(): Promise<FaqListResponse> {
    return this.faq.listPublished();
  }
}
