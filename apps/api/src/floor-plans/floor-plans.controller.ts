import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParamPipe } from '../common/pipes/id-param.pipe';
import { GENERATE_THROTTLE } from '../common/throttle.constants';
import { type AuthenticatedUser } from '../common/types/request.types';
import { type FloorPlanDto } from './floor-plan.mapper';
import { FloorPlansService } from './floor-plans.service';

@ApiTags('floor-plans')
@ApiCookieAuth()
@Controller('projects/:id/floor-plan')
export class FloorPlansController {
  constructor(private readonly floorPlans: FloorPlansService) {}

  @Throttle(GENERATE_THROTTLE)
  @Get()
  @ApiOperation({
    summary: 'Deterministic 2D floor plan for a configured project',
    description:
      'Returns the persisted plan, regenerating it when the configuration or the engine ' +
      'version changed. 409 PROJECT_NOT_CONFIGURED when land, house or rooms are missing; ' +
      '422 FLOOR_PLAN_UNAVAILABLE with `details.issues` when the engine rejects the layout.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<FloorPlanDto> {
    return this.floorPlans.findOne(user.id, id);
  }
}
