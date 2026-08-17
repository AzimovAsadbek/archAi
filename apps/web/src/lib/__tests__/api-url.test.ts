import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * URL assembly for the API client.
 *
 * These exist because of a shipped outage. `buildUrl` used
 * `new URL(path, API_BASE_URL)`, and when the base is the empty string —
 * "same origin", which is exactly what a single-domain deployment configures —
 * `new URL` throws `TypeError: Invalid URL`. The throw happened inside the
 * request's own try/catch, so it was reported as "could not reach the server"
 * while no request was ever made: registration, login and every server-rendered
 * fetch failed, and it looked like a network problem rather than a bug.
 *
 * Nothing caught it because the deployment was verified with curl against the
 * proxy, which never runs this code.
 *
 * The module reads its base at import time, so each case re-imports with a
 * fresh environment.
 */

async function loadApi(env: { publicUrl?: string; serverOrigin?: string }) {
  vi.resetModules();
  if (env.publicUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = env.publicUrl;
  if (env.serverOrigin === undefined) delete process.env.API_ORIGIN;
  else process.env.API_ORIGIN = env.serverOrigin;
  return import('../api');
}

const originalPublic = process.env.NEXT_PUBLIC_API_URL;
const originalOrigin = process.env.API_ORIGIN;

afterEach(() => {
  if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalPublic;
  if (originalOrigin === undefined) delete process.env.API_ORIGIN;
  else process.env.API_ORIGIN = originalOrigin;
  vi.unstubAllGlobals();
});

describe('API base URL', () => {
  it('treats "same-origin" and an empty value as the same instruction', async () => {
    const sameOrigin = await loadApi({ publicUrl: 'same-origin' });
    expect(sameOrigin.API_BASE_URL).toBe('');

    const empty = await loadApi({ publicUrl: '' });
    expect(empty.API_BASE_URL).toBe('');
  });

  it('uses an absolute origin verbatim, without a trailing slash', async () => {
    const api = await loadApi({ publicUrl: 'https://api.example.com/' });
    expect(api.API_BASE_URL).toBe('https://api.example.com');
  });

  it('falls back to the local API when nothing is configured', async () => {
    const api = await loadApi({});
    expect(api.API_BASE_URL).toBe('http://localhost:3001');
  });
});

describe('buildUrl (via the exported request path)', () => {
  /** Captures the URL the client would fetch, without performing a request. */
  async function urlFor(
    env: { publicUrl?: string; serverOrigin?: string },
    call: (api: Awaited<ReturnType<typeof loadApi>>) => Promise<unknown>,
  ): Promise<string> {
    const api = await loadApi(env);
    let seen = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        seen = typeof input === 'string' ? input : String((input as { url: string }).url);
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    await call(api).catch(() => undefined);
    return seen;
  }

  it('emits a relative URL in same-origin mode instead of throwing', async () => {
    // The regression: this used to throw TypeError before any fetch happened.
    const seen = await urlFor({ publicUrl: 'same-origin' }, (api) =>
      api.apiRequest('/auth/register', { method: 'POST', body: { email: 'a@b.c' } }),
    );
    expect(seen).toBe('/api/v1/auth/register');
  });

  it('keeps query parameters on a relative URL', async () => {
    const seen = await urlFor({ publicUrl: 'same-origin' }, (api) =>
      api.apiRequest('/projects', { query: { status: 'DRAFT', page: 2, blank: '' } }),
    );
    expect(seen).toBe('/api/v1/projects?status=DRAFT&page=2');
  });

  it('resolves against the rewrite target when rendering on the server', async () => {
    // No `window` here, so same-origin has no origin to resolve against and the
    // server-side rewrite target has to stand in.
    const seen = await urlFor(
      { publicUrl: 'same-origin', serverOrigin: 'https://api.example.com' },
      (api) => api.apiRequest('/content/faq'),
    );
    expect(seen).toBe('https://api.example.com/api/v1/content/faq');
  });

  it('builds an absolute URL when an explicit origin is configured', async () => {
    const seen = await urlFor({ publicUrl: 'http://localhost:3001' }, (api) =>
      api.apiRequest('/auth/login', { method: 'POST' }),
    );
    expect(seen).toBe('http://localhost:3001/api/v1/auth/login');
  });
});
