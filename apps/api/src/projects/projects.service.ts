import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type CreateProjectInput,
  type FeaturesConfig,
  isConfigurationComplete,
  LIMITS,
  type ListProjectsQuery,
  type Paginated,
  type ProjectConfiguration,
  type ProjectDto,
  type ProjectListItemDto,
  type ProjectStatus,
  type RoomConfig,
  type UpdateProjectInput,
  validateProjectConfiguration,
} from '@archai/shared';
import { type Prisma } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import {
  type ProjectWithRooms,
  sortRooms,
  toFeaturesConfig,
  toProjectConfiguration,
  toProjectDto,
  toProjectListItemDto,
  toRoomConfig,
} from './project.mapper';

/** Only these statuses follow the DRAFT ⇄ CONFIGURED automation. */
const RECOMPUTABLE_STATUSES: readonly ProjectStatus[] = ['DRAFT', 'CONFIGURED'];
const DUPLICATE_SUFFIX = ' (nusxa)';

const WITH_SORTED_ROOMS = { rooms: { orderBy: { sortOrder: 'asc' } } } as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string, query: ListProjectsQuery): Promise<Paginated<ProjectListItemDto>> {
    const where: Prisma.ProjectWhereInput = {
      ownerId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { rooms: true } } },
      }),
    ]);

    return {
      items: rows.map(toProjectListItemDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(ownerId: string, input: CreateProjectInput): Promise<ProjectDto> {
    const project = await this.prisma.project.create({
      data: {
        ownerId,
        name: input.name,
        description: input.description ?? null,
        status: 'DRAFT',
      },
      include: WITH_SORTED_ROOMS,
    });
    return toProjectDto(project);
  }

  async findOne(ownerId: string, id: string): Promise<ProjectDto> {
    return toProjectDto(await this.requireProject(ownerId, id));
  }

  async update(ownerId: string, id: string, input: UpdateProjectInput): Promise<ProjectDto> {
    const project = await this.requireProject(ownerId, id);
    if (project.status === 'ARCHIVED') {
      throw new ConflictException({
        code: ERROR_CODES.PROJECT_ARCHIVED,
        message: 'Archived projects cannot be modified — unarchive it first',
      });
    }

    const nextConfig = this.mergeConfiguration(project, input);
    const validation = validateProjectConfiguration(nextConfig);
    if (validation.errors.length > 0) {
      // Nothing is persisted when the resulting configuration breaks domain rules.
      throw new UnprocessableEntityException({
        code: ERROR_CODES.DOMAIN_VALIDATION_ERROR,
        message: 'The resulting project configuration is invalid',
        details: { errors: validation.errors, warnings: validation.warnings },
      });
    }

    const data = this.toUpdateData(input, nextConfig);
    data.status = this.recomputeStatus(project.status, nextConfig);

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data });
      if (input.rooms !== undefined) {
        await tx.room.deleteMany({ where: { projectId: project.id } });
        const rooms = nextConfig.rooms ?? [];
        if (rooms.length > 0) {
          await tx.room.createMany({
            data: rooms.map((room, index) => ({
              projectId: project.id,
              type: room.type,
              floor: room.floor,
              widthM: room.widthM ?? null,
              lengthM: room.lengthM ?? null,
              label: room.label ?? null,
              sortOrder: index,
            })),
          });
        }
      }
    });

    return this.findOne(ownerId, project.id);
  }

  async softDelete(ownerId: string, id: string): Promise<void> {
    const result = await this.prisma.project.updateMany({
      where: { id, ownerId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw this.notFound();
    }
  }

  async archive(ownerId: string, id: string): Promise<ProjectDto> {
    const project = await this.requireProject(ownerId, id);
    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: { status: 'ARCHIVED' },
      include: WITH_SORTED_ROOMS,
    });
    return toProjectDto(updated);
  }

  async unarchive(ownerId: string, id: string): Promise<ProjectDto> {
    const project = await this.requireProject(ownerId, id);
    const config = toProjectConfiguration(project);
    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: { status: isConfigurationComplete(config) ? 'CONFIGURED' : 'DRAFT' },
      include: WITH_SORTED_ROOMS,
    });
    return toProjectDto(updated);
  }

  async duplicate(ownerId: string, id: string): Promise<ProjectDto> {
    const source = await this.requireProject(ownerId, id);
    const config = toProjectConfiguration(source);

    const copy = await this.prisma.project.create({
      data: {
        ownerId,
        name: duplicateName(source.name),
        description: source.description,
        status: isConfigurationComplete(config) ? 'CONFIGURED' : 'DRAFT',
        landAreaM2: source.landAreaM2,
        landWidthM: source.landWidthM,
        landLengthM: source.landLengthM,
        houseWidthM: source.houseWidthM,
        houseLengthM: source.houseLengthM,
        floorCount: source.floorCount,
        style: source.style,
        hasGarage: source.hasGarage,
        hasTerrace: source.hasTerrace,
        hasBalcony: source.hasBalcony,
        hasPool: source.hasPool,
        hasGarden: source.hasGarden,
        rooms: {
          create: sortRooms(source.rooms).map((room, index) => ({
            type: room.type,
            floor: room.floor,
            widthM: room.widthM,
            lengthM: room.lengthM,
            label: room.label,
            sortOrder: index,
          })),
        },
      },
      include: WITH_SORTED_ROOMS,
    });

    return toProjectDto(copy);
  }

  /** Owner-scoped lookup; anything else (missing or foreign) is a 404. */
  private async requireProject(ownerId: string, id: string): Promise<ProjectWithRooms> {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: WITH_SORTED_ROOMS,
    });
    if (!project) {
      throw this.notFound();
    }
    return project;
  }

  /** Stored configuration with the incoming blocks applied (blocks replace wholesale). */
  private mergeConfiguration(
    project: ProjectWithRooms,
    input: UpdateProjectInput,
  ): ProjectConfiguration {
    const stored = toProjectConfiguration(project);
    const rooms: RoomConfig[] =
      input.rooms !== undefined ? input.rooms : sortRooms(project.rooms).map(toRoomConfig);
    const features: FeaturesConfig =
      input.features !== undefined
        ? { ...toFeaturesConfig(project), ...input.features }
        : toFeaturesConfig(project);

    return {
      land: input.land !== undefined ? (input.land ?? null) : stored.land,
      house: input.house !== undefined ? (input.house ?? null) : stored.house,
      rooms,
      features,
    };
  }

  private toUpdateData(
    input: UpdateProjectInput,
    config: ProjectConfiguration,
  ): Prisma.ProjectUpdateInput {
    const data: Prisma.ProjectUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.description !== undefined) {
      data.description = input.description ?? null;
    }
    if (input.land !== undefined) {
      data.landAreaM2 = config.land?.areaM2 ?? null;
      data.landWidthM = config.land?.widthM ?? null;
      data.landLengthM = config.land?.lengthM ?? null;
    }
    if (input.house !== undefined) {
      data.houseWidthM = config.house?.widthM ?? null;
      data.houseLengthM = config.house?.lengthM ?? null;
      data.floorCount = config.house?.floorCount ?? null;
      data.style = config.house?.style ?? null;
    }
    if (input.features !== undefined) {
      const features = config.features ?? {};
      data.hasGarage = features.garage ?? false;
      data.hasTerrace = features.terrace ?? false;
      data.hasBalcony = features.balcony ?? false;
      data.hasPool = features.pool ?? false;
      data.hasGarden = features.garden ?? false;
    }

    return data;
  }

  private recomputeStatus(current: ProjectStatus, config: ProjectConfiguration): ProjectStatus {
    if (!RECOMPUTABLE_STATUSES.includes(current)) {
      return current;
    }
    return isConfigurationComplete(config) ? 'CONFIGURED' : 'DRAFT';
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Project not found',
    });
  }
}

function duplicateName(name: string): string {
  const maxBase = LIMITS.project.nameMax - DUPLICATE_SUFFIX.length;
  const base = name.length > maxBase ? name.slice(0, maxBase) : name;
  return `${base}${DUPLICATE_SUFFIX}`;
}
