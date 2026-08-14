import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '../common/error-codes';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { type AppRequest, readCookie } from '../common/types/request.types';
import { AUTH_COOKIES } from './auth.constants';
import { TokenService } from './token.service';

/** Global guard: verifies the `archai_access` cookie unless the route is @Public. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AppRequest>();
    const token = readCookie(request, AUTH_COOKIES.access);
    if (!token) {
      throw this.unauthorized();
    }

    try {
      const payload = await this.tokens.verifyAccessToken(token);
      request.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication required',
    });
  }
}
