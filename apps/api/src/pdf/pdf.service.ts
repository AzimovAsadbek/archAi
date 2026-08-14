import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type FloorPlan } from '@archai/floor-plan-engine';
import { isConfigurationComplete } from '@archai/shared';
import { type Prisma } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import { EstimatesService } from '../estimates/estimates.service';
import { FloorPlansService } from '../floor-plans/floor-plans.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  sortRooms,
  toFeaturesConfig,
  toProjectConfiguration,
  toRoomConfig,
} from '../projects/project.mapper';
import { type PdfLocale } from './pdf-strings';
import { renderProjectPdf } from './render/pdf-document';
import { type PdfReport } from './render/report';
import { slugify } from './render/format';

const WITH_ROOMS_AND_OWNER = {
  rooms: { orderBy: { sortOrder: 'asc' } },
  owner: { select: { fullName: true } },
} as const;

type ProjectForExport = Prisma.ProjectGetPayload<{ include: typeof WITH_ROOMS_AND_OWNER }>;

/** The report, plus everything the HTTP layer needs to send it. */
export interface PdfExport {
  buffer: Buffer;
  /** ASCII filename for the `filename=` parameter. */
  filename: string;
  /** Human name for the RFC 5987 `filename*` parameter. */
  utf8Filename: string;
}

/** Finish tier the report is priced at in v1 (docs/pdf-export.md §Document). */
const REPORT_FINISH_LEVEL = 'STANDARD' as const;

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly floorPlans: FloorPlansService,
    private readonly estimates: EstimatesService,
  ) {}

  /**
   * Renders the project report. Nothing is computed here: the geometry comes
   * from `FloorPlansService` (cached, deterministic) and the prices from
   * `EstimatesService` (the one active rule set), exactly as the 2D and estimate
   * tabs receive them — so the document can never disagree with the app.
   */
  async export(ownerId: string, projectId: string, locale: PdfLocale): Promise<PdfExport> {
    const project = await this.requireProject(ownerId, projectId);
    const config = toProjectConfiguration(project);
    // `land` and `house` are non-null whenever the configuration is complete —
    // checked for the compiler, and 409 is the honest answer for anything less.
    if (!isConfigurationComplete(config) || !config.land || !config.house) {
      throw new ConflictException({
        code: ERROR_CODES.PROJECT_NOT_CONFIGURED,
        message: 'Project configuration is incomplete — land, house and rooms are required',
      });
    }

    const [plan, { estimate }] = await Promise.all([
      this.floorPlanOrNull(ownerId, projectId),
      this.estimates.findOne(ownerId, projectId, REPORT_FINISH_LEVEL),
    ]);

    const report: PdfReport = {
      locale,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        updatedAt: project.updatedAt,
      },
      ownerName: project.owner.fullName,
      land: config.land,
      house: config.house,
      features: toFeaturesConfig(project),
      rooms: sortRooms(project.rooms).map(toRoomConfig),
      plan,
      estimate,
    };

    const buffer = await renderProjectPdf(report);
    const slug = slugify(project.name);
    return {
      buffer,
      filename: `archai-${slug.length > 0 ? slug : project.id}.pdf`,
      utf8Filename: `archai-${project.name}.pdf`,
    };
  }

  /**
   * A configuration the engine cannot lay out still has a valid summary and a
   * valid price, so the plan section is dropped instead of failing the export —
   * the endpoint's only error answers are 404 and 409 (docs/pdf-export.md
   * §Endpoint). Every other failure propagates untouched.
   */
  private async floorPlanOrNull(ownerId: string, projectId: string): Promise<FloorPlan | null> {
    try {
      const { plan } = await this.floorPlans.findOne(ownerId, projectId);
      return plan;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.UNPROCESSABLE_ENTITY) {
        return null;
      }
      throw error;
    }
  }

  /** Owner-scoped lookup; anything else (missing or foreign) is a 404. */
  private async requireProject(ownerId: string, id: string): Promise<ProjectForExport> {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: WITH_ROOMS_AND_OWNER,
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
