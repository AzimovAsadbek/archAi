import { Module } from '@nestjs/common';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';

@Module({
  controllers: [EstimatesController],
  providers: [EstimatesService],
  // The PDF export prices through the same service, never its own copy.
  exports: [EstimatesService],
})
export class EstimatesModule {}
