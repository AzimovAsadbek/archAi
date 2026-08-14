import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok';
  db: 'up' | 'down';
}

@ApiTags('meta')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe with database reachability' })
  async health(): Promise<HealthResponse> {
    return { status: 'ok', db: await this.databaseStatus() };
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
