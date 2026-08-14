import { Module } from '@nestjs/common';
import { FloorPlansController } from './floor-plans.controller';
import { FloorPlansService } from './floor-plans.service';

@Module({
  controllers: [FloorPlansController],
  providers: [FloorPlansService],
  // The PDF export renders the same geometry rather than generating its own.
  exports: [FloorPlansService],
})
export class FloorPlansModule {}
