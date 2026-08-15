import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  API,
  type Cookies,
  cookieHeader,
  createTestApp,
  httpServer,
  registerUser,
  resetDatabase,
} from './utils/test-app';

/** Regression coverage for fixes made during the independent audit. */
describe('Audit fixes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('health & readiness probes', () => {
    it('GET /health is liveness — 200 with db status', async () => {
      const res = await request(server).get(`${API}/health`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
    });

    it('GET /ready is readiness — 200 while the database is reachable', async () => {
      const res = await request(server).get(`${API}/ready`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
    });
  });

  describe('register error keys (missing fields)', () => {
    it('returns the stable `required` key for missing password and fullName', async () => {
      const res = await request(server).post(`${API}/auth/register`).send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      const byField = new Map<string, string>(
        (res.body.details as { path: unknown[]; message: string }[]).map((issue) => [
          issue.path.map(String).join('.'),
          issue.message,
        ]),
      );
      // The point of the fix: missing fields yield stable snake_case keys, not raw
      // English zod type errors.
      expect(byField.get('password')).toBe('required');
      expect(byField.get('fullName')).toBe('required');
      expect(byField.get('email')).toBe('invalid_email');
    });
  });

  describe('blog coverImageUrl validation', () => {
    let adminCookies: Cookies;

    beforeAll(async () => {
      const admin = await registerUser(server, {
        email: 'audit-admin@archai.uz',
        password: 'Admin1234!',
        fullName: 'Audit Admin',
      });
      await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
      adminCookies = admin.cookies;
    });

    const blogBody = (coverImageUrl: string | null) => ({
      slug: 'audit-cover-test',
      title: 'Cover test',
      excerpt: 'Testing cover validation',
      body: 'Body text',
      authorName: 'Audit',
      coverImageUrl,
    });

    it.each([
      'javascript:alert(1)',
      'http://tracker.example.com/pixel.gif',
      'data:image/png;base64,AAAA',
      'not a url',
      '//evil.com/x.png',
    ])('rejects an unsafe coverImageUrl (%s) with 400', async (url) => {
      const res = await request(server)
        .post(`${API}/admin/blog`)
        .set('Cookie', cookieHeader(adminCookies))
        .send(blogBody(url));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts an https coverImageUrl (201) and null (201)', async () => {
      const ok = await request(server)
        .post(`${API}/admin/blog`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ ...blogBody('https://cdn.example.com/cover.jpg'), slug: 'audit-cover-https' });
      expect(ok.status).toBe(201);

      const nullCover = await request(server)
        .post(`${API}/admin/blog`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ ...blogBody(null), slug: 'audit-cover-null' });
      expect(nullCover.status).toBe(201);
    });
  });
});
