import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthResponse,
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from '@archai/shared';
import { type Request, type Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AUTH_RATE_LIMIT, RATE_LIMIT_TTL_MS } from './auth.constants';
import { AuthService } from './auth.service';

const AUTH_THROTTLE = { default: { limit: AUTH_RATE_LIMIT, ttl: RATE_LIMIT_TTL_MS } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account and start a session' })
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.auth.register(body, res, userAgentOf(req));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for session cookies' })
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.auth.login(body, res, userAgentOf(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and issue new cookies' })
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.auth.refresh(req, res, userAgentOf(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the session and clear cookies' })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return this.auth.logout(req, res);
  }
}

function userAgentOf(req: Request): string | undefined {
  return req.get('user-agent') ?? undefined;
}
