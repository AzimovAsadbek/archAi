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
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateProjectInput,
  createProjectSchema,
  type ListProjectsQuery,
  listProjectsQuerySchema,
  type Paginated,
  type ProjectDto,
  type ProjectListItemDto,
  type UpdateProjectInput,
  updateProjectSchema,
} from '@archai/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParamPipe } from '../common/pipes/id-param.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AuthenticatedUser } from '../common/types/request.types';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiCookieAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List own projects' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listProjectsQuerySchema)) query: ListProjectsQuery,
  ): Promise<Paginated<ProjectListItemDto>> {
    return this.projects.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft project' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ): Promise<ProjectDto> {
    return this.projects.create(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Full project with rooms and fresh validation' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<ProjectDto> {
    return this.projects.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Replace configuration blocks' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ): Promise<ProjectDto> {
    return this.projects.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a project' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<void> {
    return this.projects.softDelete(user.id, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a project' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<ProjectDto> {
    return this.projects.archive(user.id, id);
  }

  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unarchive a project (status recomputed)' })
  unarchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<ProjectDto> {
    return this.projects.unarchive(user.id, id);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate a project including rooms' })
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', IdParamPipe) id: string,
  ): Promise<ProjectDto> {
    return this.projects.duplicate(user.id, id);
  }
}
