import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '../common/types/request.types';
import { type FloorPlanDto } from './floor-plan.mapper';
import { FloorPlansService } from './floor-plans.service';

@ApiTags('floor-plans')
@ApiCookieAuth()
@Controller('projects/:id/floor-plan')
export class FloorPlansController {
  constructor(private readonly floorPlans: FloorPlansService) {}

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
    @Param('id') id: string,
  ): Promise<FloorPlanDto> {
    return this.floorPlans.findOne(user.id, id);
  }
}
