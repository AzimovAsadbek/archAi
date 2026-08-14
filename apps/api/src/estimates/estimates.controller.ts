import { type EstimateQuery, estimateQuerySchema } from '@archai/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AuthenticatedUser } from '../common/types/request.types';
import { type EstimateDto, EstimatesService } from './estimates.service';

@ApiTags('estimates')
@ApiCookieAuth()
@Controller('projects/:id/estimate')
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Get()
  @ApiOperation({
    summary: 'Preliminary cost estimate for a configured project',
    description:
      'Deterministic, rule-based estimate computed on demand — never persisted, never ' +
      'AI-priced. `finishLevel` selects the finish tier (STANDARD | COMFORT | PREMIUM, ' +
      'STANDARD by default); an unknown value is 400 VALIDATION_ERROR. 409 ' +
      'PROJECT_NOT_CONFIGURED when land, house or rooms are missing.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(estimateQuerySchema)) query: EstimateQuery,
  ): Promise<EstimateDto> {
    return this.estimates.findOne(user.id, id, query.finishLevel);
  }
}
