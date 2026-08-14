import { type ApiErrorShape } from '@archai/shared';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const API_PREFIX = '/api/v1';

/** Every failure surfaced by the API client — network failures included. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.statusCode = shape.statusCode;
    this.code = shape.code;
    this.details = shape.details;
  }

  static network(message = 'Network request failed'): ApiError {
    return new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message });
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry dance (used by the auth endpoints). */
  skipAuthRefresh?: boolean;
  /**
   * Passed through to `fetch` for React Server Component reads — lets the public
   * marketing pages cache/revalidate their content fetches. Ignored in the
   * browser, where these options are no-ops.
   */
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${API_PREFIX}${path}`, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function isApiErrorShape(value: unknown): value is ApiErrorShape {
  if (typeof value !== 'object' || value === null) return false;
  const shape = value as Record<string, unknown>;
  return typeof shape.code === 'string' && typeof shape.message === 'string';
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (isApiErrorShape(payload)) {
    return new ApiError({
      statusCode:
        typeof payload.statusCode === 'number' ? payload.statusCode : response.status,
      code: payload.code,
      message: payload.message,
      details: payload.details,
    });
  }

  return new ApiError({
    statusCode: response.status,
    code: response.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL',
    message: response.statusText || 'Request failed',
  });
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, query, signal, cache, next } = options;

  const init: RequestInit & { next?: RequestOptions['next'] } = {
    method,
    credentials: 'include',
    signal,
    headers: body === undefined ? { Accept: 'application/json' } : {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (cache !== undefined) init.cache = cache;
  if (next !== undefined) init.next = next;

  try {
    return await fetch(buildUrl(path, query), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw ApiError.network(error instanceof Error ? error.message : undefined);
  }
}

/** A single in-flight refresh shared by every concurrent 401 so we never stampede. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await rawRequest('/auth/refresh', { method: 'POST' });
      return response.ok;
    } catch {
      return false;
    } finally {
      // Release on the next microtask so parallel callers share this attempt.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isAuthCall = path.startsWith('/auth/');
  let response = await rawRequest(path, options);

  if (response.status === 401 && !isAuthCall && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();
    if (!refreshed) throw await toApiError(response);
    response = await rawRequest(path, options);
  }

  if (!response.ok) throw await toApiError(response);
  return parse<T>(response);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.statusCode === 401;
}
