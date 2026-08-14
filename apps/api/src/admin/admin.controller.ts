import {
  type EstimateRules,
  estimateRulesSchema,
  type Paginated,
} from '@archai/shared';
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AuthenticatedUser } from '../common/types/request.types';
import { AdminEstimateRulesService } from './admin-estimate-rules.service';
import { AdminProjectsService } from './admin-projects.service';
import { AdminUsersService } from './admin-users.service';
import { AdminGuard } from './admin.guard';
import {
  type AdminEstimateRuleDto,
  type AdminProjectListItemDto,
  type AdminUserListItemDto,
  type AuditLogItemDto,
  type ListAdminProjectsQuery,
  listAdminProjectsQuerySchema,
  type ListAdminUsersQuery,
  listAdminUsersQuerySchema,
  type ListAuditQuery,
  listAuditQuerySchema,
  type ListEstimateRulesQuery,
  listEstimateRulesQuerySchema,
  type UpdateAdminUserInput,
  updateAdminUserSchema,
} from './admin.schema';
import { AuditService } from './audit.service';

/**
 * The whole admin surface. `AdminGuard` sits on the controller, so a route added
 * here is protected by construction; every cross-user read and every mutation
 * leaves an `audit_log` row.
 */
@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly projects: AdminProjectsService,
    private readonly estimateRules: AdminEstimateRulesService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  @ApiOperation({
    summary: 'List all users with their project and AI usage counts',
    description:
      'Cross-user read — records a `users.list` audit row. `search` matches email or ' +
      'full name case-insensitively; `isActive` filters by status. 403 FORBIDDEN for ' +
      'non-admins.',
  })
  listUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listAdminUsersQuerySchema)) query: ListAdminUsersQuery,
  ): Promise<Paginated<AdminUserListItemDto>> {
    return this.users.list(user.id, query);
  }

  @Patch('users/:id')
  @ApiOperation({
    summary: 'Activate or deactivate a user',
    description:
      'Deactivation revokes every refresh token of that user in the same transaction, ' +
      'and login is refused while inactive. 409 CANNOT_MODIFY_SELF for your own account, ' +
      '409 CANNOT_MODIFY_ADMIN for another administrator, 404 NOT_FOUND when unknown.',
  })
  updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAdminUserSchema)) body: UpdateAdminUserInput,
  ): Promise<AdminUserListItemDto> {
    return this.users.setActive(user.id, id, body);
  }

  @Get('projects')
  @ApiOperation({
    summary: 'List every user project (read-only in v1)',
    description:
      'Cross-user read — records a `projects.list` audit row. Soft-deleted projects are ' +
      'excluded. `search` matches the name case-insensitively.',
  })
  listProjects(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listAdminProjectsQuerySchema)) query: ListAdminProjectsQuery,
  ): Promise<Paginated<AdminProjectListItemDto>> {
    return this.projects.list(user.id, query);
  }

  @Get('estimate-rules')
  @ApiOperation({
    summary: 'Estimate rule versions, newest first',
    description: 'The full history including the inactive versions; not audited.',
  })
  listEstimateRules(
    @Query(new ZodValidationPipe(listEstimateRulesQuerySchema)) query: ListEstimateRulesQuery,
  ): Promise<Paginated<AdminEstimateRuleDto>> {
    return this.estimateRules.list(query);
  }

  @Post('estimate-rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Publish a new rule set and make it the active one',
    description:
      'Body is a full `EstimateRules` object (shared zod schema). `version` must not ' +
      'exist yet — 409 VERSION_EXISTS otherwise. The previous active version is ' +
      'deactivated in the same transaction, so the next estimate prices with the new one.',
  })
  createEstimateRules(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(estimateRulesSchema)) body: EstimateRules,
  ): Promise<AdminEstimateRuleDto> {
    return this.estimateRules.create(user.id, body);
  }

  @Get('audit')
  @ApiOperation({
    summary: 'Read the audit trail, newest first',
    description:
      '`action` filters by prefix (e.g. `user.`), `actorId` by administrator. Rows carry ' +
      'the actor email, null once that account is deleted.',
  })
  listAudit(
    @Query(new ZodValidationPipe(listAuditQuerySchema)) query: ListAuditQuery,
  ): Promise<Paginated<AuditLogItemDto>> {
    return this.audit.list(query);
  }
}
