import { Injectable, NotFoundException, type PipeTransform } from '@nestjs/common';
import { ERROR_CODES } from '../error-codes';

/** Accepts the id shapes Prisma's `cuid()` produces (plus a safe margin). */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Guards `:id` route params. A value that could never be a real id (control
 * bytes like NUL, absurd length, path fragments) can throw inside the Prisma
 * driver and surface as a 500; here it becomes an ordinary 404, matching the
 * "resource does not exist" answer and leaking nothing.
 */
@Injectable()
export class IdParamPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !SAFE_ID.test(value)) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Not found' });
    }
    return value;
  }
}
