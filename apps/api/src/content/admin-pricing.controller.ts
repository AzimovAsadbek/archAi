import { type Paginated } from '@archai/shared';
import {
  Body,
  Controller,
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
import {
  type AdminPricingPlanDto,
  type CreatePricingInput,
  createPricingSchema,
  type ListAdminPricingQuery,
  listAdminPricingQuerySchema,
  type UpdatePricingInput,
  updatePricingSchema,
} from './content.schema';
import { PricingService } from './pricing.service';

/** Admin pricing CRUD. Behind `AdminGuard`; every route writes an audit row. */
@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(AdminGuard)
@Controller('admin/pricing')
export class AdminPricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  @ApiOperation({ summary: 'List all plans incl. inactive (records pricing.list)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listAdminPricingQuerySchema)) query: ListAdminPricingQuery,
  ): Promise<Paginated<AdminPricingPlanDto>> {
    return this.pricing.listAll(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a plan (409 CONFLICT on a duplicate key)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPricingSchema)) body: CreatePricingInput,
  ): Promise<AdminPricingPlanDto> {
    return this.pricing.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a plan (404 NOT_FOUND when unknown). Key is immutable.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(updatePricingSchema)) body: UpdatePricingInput,
  ): Promise<AdminPricingPlanDto> {
    return this.pricing.update(user.id, id, body);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a plan — hides it from the public list' })
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<AdminPricingPlanDto> {
    return this.pricing.deactivate(user.id, id);
  }
}
