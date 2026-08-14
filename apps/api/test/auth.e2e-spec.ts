import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  API,
  applyCookies,
  cookieHeader,
  type Cookies,
  createTestApp,
  httpServer,
  resetDatabase,
  setCookieStrings,
} from './utils/test-app';

const USER = {
  email: 'auth.user@archai.uz',
  password: 'Passw0rd1',
  fullName: 'Auth Tester',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let registrationCookies: Cookies = {};
  let userId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('app wiring', () => {
    it('exposes a public health endpoint reporting the database state', async () => {
      const res = await request(server).get(`${API}/health`).expect(200);
      expect(res.body).toEqual({ status: 'ok', db: 'up' });
    });

    it('echoes an incoming request id', async () => {
      const res = await request(server)
        .get(`${API}/health`)
        .set('x-request-id', 'test-request-id')
        .expect(200);
      expect(res.headers['x-request-id']).toBe('test-request-id');
    });

    it('returns the ApiErrorShape for unknown routes', async () => {
      const res = await request(server).get(`${API}/does-not-exist`).expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
      expect(typeof res.body.message).toBe('string');
    });
  });

  describe('POST /auth/register', () => {
    it('creates the account and sets both httpOnly cookies', async () => {
      const res = await request(server).post(`${API}/auth/register`).send(USER).expect(201);

      expect(res.body.user).toMatchObject({
        email: USER.email,
        fullName: USER.fullName,
        role: 'USER',
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(typeof res.body.user.createdAt).toBe('string');

      const cookies = setCookieStrings(res);
      const access = cookies.find((cookie) => cookie.startsWith('archai_access='));
      const refresh = cookies.find((cookie) => cookie.startsWith('archai_refresh='));

      expect(access).toBeDefined();
      expect(access).toContain('HttpOnly');
      expect(access).toContain('SameSite=Lax');
      expect(access).toContain('Path=/');
      expect(refresh).toBeDefined();
      expect(refresh).toContain('HttpOnly');
      expect(refresh).toContain('Path=/api/v1/auth');

      registrationCookies = applyCookies(res);
      userId = String(res.body.user.id);

      const stored = await prisma.user.findUnique({ where: { email: USER.email } });
      expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
      const res = await request(server)
        .post(`${API}/auth/register`)
        .send({ ...USER, fullName: 'Someone Else' })
        .expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
    });

    it('rejects a weak password with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .post(`${API}/auth/register`)
        .send({ email: 'weak@archai.uz', password: 'short', fullName: 'Weak Pass' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThan(0);
      expect(await prisma.user.count({ where: { email: 'weak@archai.uz' } })).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('accepts valid credentials', async () => {
      const res = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: USER.email, password: USER.password })
        .expect(200);

      expect(res.body.user.email).toBe(USER.email);
      expect(setCookieStrings(res)).toHaveLength(2);
    });

    it('rejects a wrong password with a uniform 401', async () => {
      const res = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: USER.email, password: 'WrongPassw0rd' })
        .expect(401);

      expect(res.body).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    });

    it('rejects an unknown email with the very same error', async () => {
      const res = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: 'nobody@archai.uz', password: USER.password })
        .expect(401);

      expect(res.body).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('GET /users/me', () => {
    it('requires the access cookie', async () => {
      const res = await request(server).get(`${API}/users/me`).expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    });

    it('returns the current user when authenticated', async () => {
      const res = await request(server)
        .get(`${API}/users/me`)
        .set('Cookie', cookieHeader(registrationCookies))
        .expect(200);

      expect(res.body).toMatchObject({ id: userId, email: USER.email, role: 'USER' });
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and rejects the consumed one', async () => {
      const login = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: USER.email, password: USER.password })
        .expect(200);
      const first = applyCookies(login);

      const rotated = await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${first.archai_refresh}`)
        .expect(200);
      const second = applyCookies(rotated, first);

      expect(rotated.body.user.email).toBe(USER.email);
      expect(second.archai_refresh).toBeDefined();
      expect(second.archai_refresh).not.toBe(first.archai_refresh);

      await request(server)
        .get(`${API}/users/me`)
        .set('Cookie', cookieHeader(second))
        .expect(200);

      // The consumed token is rejected …
      const reuse = await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${first.archai_refresh}`)
        .expect(401);
      expect(reuse.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });

      // … but an immediate reuse is treated as a benign concurrent rotation:
      // the sibling's freshly issued token still works (no family kill).
      await request(server)
        .get(`${API}/users/me`)
        .set('Cookie', cookieHeader(second))
        .expect(200);
    });

    it('revokes the whole family when a token is reused past the grace window', async () => {
      const login = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: USER.email, password: USER.password })
        .expect(200);
      const first = applyCookies(login);

      const rotated = await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${first.archai_refresh}`)
        .expect(200);
      const second = applyCookies(rotated, first);

      // Age the consumed token's revocation past the grace window so its reuse
      // reads as genuine theft rather than a concurrent refresh.
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: { not: null } },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });

      await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${first.archai_refresh}`)
        .expect(401);

      // Theft detection has now revoked every session of that user, including
      // the token minted by the legitimate rotation.
      await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${second.archai_refresh}`)
        .expect(401);

      const tokens = await prisma.refreshToken.findMany({ where: { userId } });
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every((token) => token.revokedAt !== null)).toBe(true);
    });

    it('rejects a missing refresh cookie', async () => {
      await request(server).post(`${API}/auth/refresh`).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears cookies, revokes the token and blocks later refreshes', async () => {
      const login = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: USER.email, password: USER.password })
        .expect(200);
      const jar = applyCookies(login);

      const logout = await request(server)
        .post(`${API}/auth/logout`)
        .set('Cookie', cookieHeader(jar))
        .expect(204);

      const cleared = applyCookies(logout, jar);
      expect(cleared.archai_access).toBeUndefined();
      expect(cleared.archai_refresh).toBeUndefined();

      await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${jar.archai_refresh}`)
        .expect(401);
    });

    it('succeeds without a session', async () => {
      await request(server).post(`${API}/auth/logout`).expect(204);
    });
  });
});
