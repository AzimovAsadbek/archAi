import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AuthenticatedUser } from '../common/types/request.types';
import { AI_THROTTLE } from './ai.constants';
import {
  type AnswerResponseDto,
  type AskRequestInput,
  askRequestSchema,
  type ParseProjectRequestInput,
  parseProjectRequestSchema,
  type ParseProjectResponseDto,
  type SuggestRequestInput,
  suggestRequestSchema,
  type SuggestResponseDto,
} from './ai.schema';
import { AiService, type AiStatusDto } from './ai.service';

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

  @Throttle(AI_THROTTLE)
  @Post('projects/:id/suggest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advisory design suggestions for an existing project' })
  suggest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Body(new ZodValidationPipe(suggestRequestSchema)) body: SuggestRequestInput,
  ): Promise<SuggestResponseDto> {
    return this.ai.suggestImprovements(user.id, projectId, body);
  }

  @Throttle(AI_THROTTLE)
  @Post('projects/:id/ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Answer a question about an existing project, grounded in its data' })
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Body(new ZodValidationPipe(askRequestSchema)) body: AskRequestInput,
  ): Promise<AnswerResponseDto> {
    return this.ai.answerQuestion(user.id, projectId, body);
  }

  @Get('status')
  @ApiOperation({ summary: 'Runtime AI availability and per-user limit (no secrets)' })
  status(): AiStatusDto {
    return this.ai.getStatus();
  }
}
