import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FLOOR_PLAN_ENGINE_VERSION, generateFloorPlan } from '@archai/floor-plan-engine';
import { isConfigurationComplete } from '@archai/shared';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { type ProjectWithRooms, toProjectConfiguration } from '../projects/project.mapper';
import {
  type FloorPlanDto,
  hashFloorPlanInput,
  toFloorPlan,
  toFloorPlanDto,
  toFloorPlanInput,
  toGeometryJson,
} from './floor-plan.mapper';

const WITH_SORTED_ROOMS = { rooms: { orderBy: { sortOrder: 'asc' } } } as const;

@Injectable()
export class FloorPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cached, deterministic geometry for a project. The stored row is reused while
   * both the engine version and the input hash match; anything else recomputes.
   */
  async findOne(ownerId: string, projectId: string): Promise<FloorPlanDto> {
    const project = await this.requireProject(ownerId, projectId);
    const config = toProjectConfiguration(project);
    // `house` is non-null whenever the configuration is complete — checked for the compiler.
    if (!isConfigurationComplete(config) || !config.house) {
      throw new ConflictException({
        code: ERROR_CODES.PROJECT_NOT_CONFIGURED,
        message: 'Project configuration is incomplete — land, house and rooms are required',
      });
    }

    const input = toFloorPlanInput(project, config.house);
    const inputHash = hashFloorPlanInput(input);

    const stored = await this.prisma.floorPlan.findUnique({ where: { projectId: project.id } });
    if (
      stored !== null &&
      stored.inputHash === inputHash &&
      stored.engineVersion === FLOOR_PLAN_ENGINE_VERSION
    ) {
      return toFloorPlanDto(toFloorPlan(stored.geometry), stored.generatedAt);
    }

    const result = generateFloorPlan(input);
    if (!result.ok) {
      // Failures are never persisted, and geometry from an older configuration
      // must not survive it — the plan no longer describes this project.
      await this.prisma.floorPlan.deleteMany({ where: { projectId: project.id } });
      throw new UnprocessableEntityException({
        code: ERROR_CODES.FLOOR_PLAN_UNAVAILABLE,
        message: 'The floor-plan engine cannot lay out this configuration',
        details: { issues: result.issues },
      });
    }

    const generatedAt = new Date();
    const geometry = toGeometryJson(result.plan);
    const row = await this.prisma.floorPlan.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        engineVersion: FLOOR_PLAN_ENGINE_VERSION,
        inputHash,
        geometry,
        generatedAt,
      },
      update: {
        engineVersion: FLOOR_PLAN_ENGINE_VERSION,
        inputHash,
        geometry,
        generatedAt,
      },
    });

    return toFloorPlanDto(result.plan, row.generatedAt);
  }

  /** Owner-scoped lookup; anything else (missing or foreign) is a 404. */
  private async requireProject(ownerId: string, id: string): Promise<ProjectWithRooms> {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: WITH_SORTED_ROOMS,
    });
    if (!project) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Project not found',
      });
    }
    return project;
  }
}
