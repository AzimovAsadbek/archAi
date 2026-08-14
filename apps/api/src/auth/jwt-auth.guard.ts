import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '../common/error-codes';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { type AppRequest, readCookie } from '../common/types/request.types';
import { AUTH_COOKIES } from './auth.constants';
import { TokenService } from './token.service';

/** Global guard: verifies the `archai_access` cookie unless the route is @Public. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
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

    let sub: string;
    try {
      const payload = await this.tokens.verifyAccessToken(token);
      sub = payload.sub;
    } catch {
      throw this.unauthorized();
    }

    // Re-check the account on every request so deactivation (or deletion) takes
    // effect immediately, not only after the 15-minute access token expires.
    // `role` comes from the live row, never the token claim, so a demotion is
    // enforced the same way.
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw this.unauthorized();
    }

    request.user = { id: user.id, role: user.role };
    return true;
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication required',
    });
  }
}
