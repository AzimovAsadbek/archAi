import { Injectable, NotFoundException, type PipeTransform } from '@nestjs/common';
import { ERROR_CODES } from '../error-codes';

/** Lowercase kebab-case slugs, the only shape a real blog post can have. */
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Guards `:slug` route params. A value that could never be a real slug becomes an
 * ordinary 404 (as `IdParamPipe` does for ids), so a malformed slug and a missing
 * post give the same answer and leak nothing.
 */
@Injectable()
export class SlugParamPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || value.length > 140 || !SAFE_SLUG.test(value)) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Not found' });
    }
    return value;
  }
}
