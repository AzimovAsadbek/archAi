import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';
import { ERROR_CODES } from '../error-codes';

/**
 * Validates request payloads with a shared zod schema.
 * Failures become 400 `VALIDATION_ERROR` with the raw zod issues as details.
 */
@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
