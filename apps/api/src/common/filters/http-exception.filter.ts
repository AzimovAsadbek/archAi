import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorShape } from '@archai/shared';
import { type Response } from 'express';
import { ERROR_CODES, type ErrorCode } from '../error-codes';
import { type AppRequest, isRecord } from '../types/request.types';

const STATUS_CODE_FALLBACK: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.DOMAIN_VALIDATION_ERROR,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
};

/** Client-facing wording for exceptions whose own message is an internal string. */
const STATUS_MESSAGES: Record<number, string> = {
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests — please retry shortly',
};

const INTERNAL_ERROR: ApiErrorShape = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  code: ERROR_CODES.INTERNAL,
  message: 'Internal server error',
};

/**
 * The only 5xx codes allowed through verbatim. They describe an upstream or
 * deployment condition the client must react to (retry, or tell the user an
 * administrator has to act) — not an internal failure worth hiding. Their
 * messages are fixed strings written for clients, never raw internal text.
 */
const CLIENT_SAFE_5XX_CODES: ReadonlySet<string> = new Set<string>([
  ERROR_CODES.AI_NOT_CONFIGURED,
  ERROR_CODES.AI_PROVIDER_ERROR,
  ERROR_CODES.AI_TIMEOUT,
  // Readiness probe: the 503 must reach orchestrators/LBs with its status intact.
  ERROR_CODES.NOT_READY,
]);

function isClientSafe5xx(payload: unknown): boolean {
  return (
    isRecord(payload) &&
    typeof payload.code === 'string' &&
    CLIENT_SAFE_5XX_CODES.has(payload.code)
  );
}

/**
 * Catch-all filter that renders every failure as `ApiErrorShape`.
 * Internal errors are logged in full but never leak to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AppRequest>();
    const body = this.toApiError(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} failed [requestId=${request.requestId ?? 'n/a'}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown): ApiErrorShape {
    if (!(exception instanceof HttpException)) {
      return INTERNAL_ERROR;
    }

    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR && !isClientSafe5xx(payload)) {
      // Never surface internal messages, even for deliberate 5xx HttpExceptions.
      return { ...INTERNAL_ERROR, statusCode };
    }

    const fallbackCode = STATUS_CODE_FALLBACK[statusCode] ?? ERROR_CODES.INTERNAL;

    const statusMessage = STATUS_MESSAGES[statusCode];

    if (!isRecord(payload)) {
      const raw = typeof payload === 'string' && payload.length > 0 ? payload : exception.message;
      return { statusCode, code: fallbackCode, message: statusMessage ?? raw };
    }

    const code = typeof payload.code === 'string' ? payload.code : fallbackCode;
    const message =
      this.readMessage(payload.message) ?? statusMessage ?? exception.message;
    const error: ApiErrorShape = { statusCode, code, message };
    if (payload.details !== undefined) {
      error.details = payload.details;
    }
    return error;
  }

  private readMessage(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (Array.isArray(value)) {
      const parts = value.filter((item): item is string => typeof item === 'string');
      return parts.length > 0 ? parts.join(', ') : undefined;
    }
    return undefined;
  }
}
