import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type NextFunction, type Response } from 'express';
import { type AppRequest } from '../types/request.types';

export const REQUEST_ID_HEADER = 'x-request-id';
const MAX_REQUEST_ID_LENGTH = 120;

/** Propagates (or mints) a correlation id for every request. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: AppRequest, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId =
      typeof candidate === 'string' && candidate.trim().length > 0
        ? candidate.trim().slice(0, MAX_REQUEST_ID_LENGTH)
        : randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
