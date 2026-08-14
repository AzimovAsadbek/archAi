import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';
import { type AppRequest } from '../common/types/request.types';

/**
 * Role check for `/admin/*`, applied on top of the global `JwtAuthGuard` (which
 * has already put `{ id, role }` on the request). Authorization is server-side
 * only — the web guard is a convenience, never the enforcement point.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Administrator role required',
      });
    }
    return true;
  }
}
