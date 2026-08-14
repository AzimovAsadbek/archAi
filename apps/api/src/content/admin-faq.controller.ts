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
import {
  type AdminFaqItemDto,
  type CreateFaqInput,
  createFaqSchema,
  type ListAdminFaqQuery,
  listAdminFaqQuerySchema,
  type UpdateFaqInput,
  updateFaqSchema,
} from './content.schema';
import { FaqService } from './faq.service';

/** Admin FAQ CRUD. Behind `AdminGuard`; every route writes an audit row. */
@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(AdminGuard)
@Controller('admin/faq')
export class AdminFaqController {
  constructor(private readonly faq: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'List all FAQ items incl. unpublished (records faq.list)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listAdminFaqQuerySchema)) query: ListAdminFaqQuery,
  ): Promise<Paginated<AdminFaqItemDto>> {
    return this.faq.listAll(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a FAQ item' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFaqSchema)) body: CreateFaqInput,
  ): Promise<AdminFaqItemDto> {
    return this.faq.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a FAQ item (404 NOT_FOUND when unknown)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(updateFaqSchema)) body: UpdateFaqInput,
  ): Promise<AdminFaqItemDto> {
    return this.faq.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete a FAQ item (404 NOT_FOUND when unknown)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<void> {
    return this.faq.remove(user.id, id);
  }
}
