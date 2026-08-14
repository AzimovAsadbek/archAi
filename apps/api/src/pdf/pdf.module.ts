import { Module } from '@nestjs/common';
import { EstimatesModule } from '../estimates/estimates.module';
import { FloorPlansModule } from '../floor-plans/floor-plans.module';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';

/**
 * The export reuses the geometry and pricing services rather than recomputing
 * anything, so a report can never drift from what the workspace shows.
 */
@Module({
  imports: [FloorPlansModule, EstimatesModule],
  controllers: [PdfController],
  providers: [PdfService],
})
export class PdfModule {}
