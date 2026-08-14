import { type PricingResponse } from '@archai/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PricingService } from './pricing.service';

/** Public pricing surface (docs/public-content.md §Pricing). Unauthenticated. */
@ApiTags('content')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Active pricing plans (free during beta)',
    description:
      'Active plans in display order, wrapped as `{ plans, beta: true }`. Prices are ' +
      'informational — everything is free during beta and no checkout exists. No auth.',
  })
  get(): Promise<PricingResponse> {
    return this.pricing.listActive();
  }
}
