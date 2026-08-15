import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok';
  db: 'up' | 'down';
}

@ApiTags('meta')
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness: the process is up and serving. Always 200 — it deliberately does
   * NOT gate on the database, so a DB blip doesn't get the container killed.
   * The `db` field is informational; use `/ready` to gate traffic.
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe (always 200; db field informational)' })
  async health(): Promise<HealthResponse> {
    return { status: 'ok', db: await this.databaseStatus() };
  }

  /**
   * Readiness: can the app actually serve DB-backed traffic? Returns 200 when
   * the database answers, 503 otherwise — so orchestrator health checks and
   * load balancers pull the instance out of rotation during a DB outage.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (503 when the database is unreachable)' })
  async ready(): Promise<HealthResponse> {
    if ((await this.databaseStatus()) === 'down') {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: ERROR_CODES.NOT_READY,
        message: 'Database is unreachable',
      });
    }
    return { status: 'ok', db: 'up' };
  }

  private async databaseStatus(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      this.logger.warn(
        `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'down';
    }
  }
}
