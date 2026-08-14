import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AuthenticatedUser } from '../common/types/request.types';
import { AI_THROTTLE } from './ai.constants';
import {
  type ParseProjectRequestInput,
  parseProjectRequestSchema,
  type ParseProjectResponseDto,
} from './ai.schema';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiCookieAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Throttle(AI_THROTTLE)
  @Post('parse-project')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Parse a natural-language project request into a reviewable proposal',
  })
  parseProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(parseProjectRequestSchema)) body: ParseProjectRequestInput,
  ): Promise<ParseProjectResponseDto> {
    return this.ai.parseProject(user.id, body);
  }
}
