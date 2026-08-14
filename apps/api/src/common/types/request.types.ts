import { type Request } from 'express';
import { type UserRole } from '@archai/shared';

/** Identity attached to the request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

/** Express request enriched by the app middleware/guards. */
export interface AppRequest extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a cookie without leaking `any` from the express typings. */
export function readCookie(req: Request, name: string): string | undefined {
  const cookies: unknown = req.cookies;
  if (!isRecord(cookies)) {
    return undefined;
  }
  const value = cookies[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
