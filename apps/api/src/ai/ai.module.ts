import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { architectureAIProvider } from './ai.provider';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService, architectureAIProvider],
})
export class AiModule {}
