import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES } from '../error-codes';
import { type AppRequest, type AuthenticatedUser } from '../types/request.types';

/** Injects the authenticated `{ id, role }` attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AppRequest>();
    if (!request.user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
      });
    }
    return request.user;
  },
);
