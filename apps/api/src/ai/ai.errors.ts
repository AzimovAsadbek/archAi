import { type AiErrorCode } from '@archai/ai';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '../common/error-codes';

interface AiHttpMapping {
  status: HttpStatus;
  code: ErrorCode;
  /** Fixed client-facing wording — the UI localizes by `code`. */
  message: string;
}

/**
 * Provider outcome → HTTP. Messages never carry provider internals or the user's
 * request; the full diagnostic stays in the server log.
 */
const AI_HTTP_MAPPING: Record<AiErrorCode, AiHttpMapping> = {
  AI_NOT_CONFIGURED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: ERROR_CODES.AI_NOT_CONFIGURED,
    message: 'AI features are not configured on this server',
  },
  AI_RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    code: ERROR_CODES.AI_RATE_LIMITED,
    message: 'The AI provider is rate limiting requests — please retry shortly',
  },
  AI_PROVIDER_ERROR: {
    status: HttpStatus.BAD_GATEWAY,
    code: ERROR_CODES.AI_PROVIDER_ERROR,
    message: 'The AI provider could not complete the request',
  },
  AI_TIMEOUT: {
    status: HttpStatus.BAD_GATEWAY,
    code: ERROR_CODES.AI_TIMEOUT,
    message: 'The AI provider did not respond in time',
  },
  AI_REFUSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ERROR_CODES.AI_REFUSED,
    message: 'The AI declined to answer this request',
  },
  AI_INVALID_OUTPUT: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ERROR_CODES.AI_INVALID_OUTPUT,
    message: 'The AI answer could not be read as a project — please rephrase and try again',
  },
};

export function toAiHttpException(error: AiErrorCode): HttpException {
  const mapping = AI_HTTP_MAPPING[error];
  return new HttpException({ code: mapping.code, message: mapping.message }, mapping.status);
}
