import { type EstimateRules } from '@archai/shared';
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ESTIMATE_RULES_V1 } from '../prisma/estimate-rules.v1';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  API,
  applyCookies,
  cookieHeader,
  type Cookies,
  createTestApp,
  httpServer,
  registerUser,
  resetDatabase,
} from './utils/test-app';

const ADMIN = {
  email: 'admin@archai.uz',
  password: 'Admin1234!',
  fullName: 'ArchAI Administrator',
};
const DEMO = {
  email: 'demo@archai.uz',
  password: 'Demo1234!',
  fullName: 'Aziz Karimov',
};
const SECOND_ADMIN_EMAIL = 'admin2@archai.uz';

/** Same shape the estimate suite prices: 600 m² land, 11×13 m house, 2 floors. */
const VALID_CONFIG = {
  land: { areaM2: 600, widthM: 20, lengthM: 30 },
  house: { widthM: 11, lengthM: 13, floorCount: 2, style: 'MODERN' },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0, widthM: 5.5, lengthM: 6 },
    { type: 'KITCHEN', floor: 0, widthM: 3.5, lengthM: 4.5 },
    { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4.5, label: 'Master' },
  ],
  features: { garage: true, terrace: true },
};

/** Version 2 differs in exactly one number, so the estimate must move with it. */
const RULES_V2: EstimateRules = {
  ...ESTIMATE_RULES_V1,
  version: '2',
  structureCostPerM2: ESTIMATE_RULES_V1.structureCostPerM2 * 2,
};

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let adminCookies: Cookies = {};
  let demoCookies: Cookies = {};
  let adminId = '';
  let demoId = '';
  let secondAdminId = '';
  let projectId = '';
  let rulesV1Id = '';
  /** The refresh token demo held before being deactivated. */
  let demoRefreshToken = '';

  const asAdmin = (): string => cookieHeader(adminCookies);
  const asDemo = (): string => cookieHeader(demoCookies);

  const structureOf = async (): Promise<number> => {
    const res = await request(server)
      .get(`${API}/projects/${projectId}/estimate`)
      .set('Cookie', asDemo())
      .expect(200);
    const line = res.body.estimate.lines.find((item: { key: string }) => item.key === 'structure');
    return Number(line.amount);
  };

  const auditRows = async (query: Record<string, string> = {}): Promise<AuditRow[]> => {
    const res = await request(server)
      .get(`${API}/admin/audit`)
      .query(query)
      .set('Cookie', asAdmin())
      .expect(200);
    return res.body.items as AuditRow[];
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);

    // Registration always creates a USER; the role is promoted in the database and
    // only then exchanged for a session, so the JWT carries `role: ADMIN`.
    const registeredAdmin = await registerUser(server, ADMIN);
    adminId = registeredAdmin.id;
    const adminRow = await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await request(server)
      .post(`${API}/auth/login`)
      .send({ email: ADMIN.email, password: ADMIN.password })
      .expect(200);
    adminCookies = applyCookies(adminLogin);

    const registeredDemo = await registerUser(server, DEMO);
    demoId = registeredDemo.id;
    demoCookies = registeredDemo.cookies;
    demoRefreshToken = demoCookies.archai_refresh ?? '';

    // A second administrator nobody may touch through the panel.
    const secondAdmin = await prisma.user.create({
      data: {
        email: SECOND_ADMIN_EMAIL,
        passwordHash: adminRow.passwordHash,
        fullName: 'Second Administrator',
        role: 'ADMIN',
      },
    });
    secondAdminId = secondAdmin.id;

    // The e2e setup only migrates — prices come from the seed, so insert them here.
    const rulesV1 = await prisma.estimateRule.create({
      data: { version: ESTIMATE_RULES_V1.version, data: ESTIMATE_RULES_V1, isActive: true },
    });
    rulesV1Id = rulesV1.id;

    const created = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asDemo())
      .send({ name: 'Oilaviy uy — Qibray' })
      .expect(201);
    projectId = String(created.body.id);
    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asDemo())
      .send(VALID_CONFIG)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control', () => {
    it('requires authentication', async () => {
      const res = await request(server).get(`${API}/admin/users`).expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    });

    it('answers 403 FORBIDDEN on every admin route for a USER', async () => {
      const routes = [
        (): request.Test => request(server).get(`${API}/admin/users`),
        (): request.Test =>
          request(server).patch(`${API}/admin/users/${demoId}`).send({ isActive: false }),
        (): request.Test => request(server).get(`${API}/admin/projects`),
        (): request.Test => request(server).get(`${API}/admin/estimate-rules`),
        (): request.Test => request(server).post(`${API}/admin/estimate-rules`).send(RULES_V2),
        (): request.Test => request(server).get(`${API}/admin/audit`),
      ];

      for (const route of routes) {
        const res = await route().set('Cookie', asDemo()).expect(403);
        expect(res.body).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      }

      // A rejected request is not an admin action, so it leaves no trail …
      expect(await prisma.auditLog.count()).toBe(0);
      // … and changed nothing.
      const demo = await prisma.user.findUnique({ where: { id: demoId } });
      expect(demo?.isActive).toBe(true);
      expect(await prisma.estimateRule.count()).toBe(1);
    });
  });

  describe('GET /admin/users', () => {
    it('lists every user with project and AI usage counts', async () => {
      const res = await request(server)
        .get(`${API}/admin/users`)
        .set('Cookie', asAdmin())
        .expect(200);

      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 3 });
      const demo = res.body.items.find((item: { id: string }) => item.id === demoId);
      expect(demo).toMatchObject({
        email: DEMO.email,
        fullName: DEMO.fullName,
        role: 'USER',
        isActive: true,
        projectCount: 1,
        aiGenerationCount: 0,
      });
      expect(typeof demo.createdAt).toBe('string');
      expect(demo.passwordHash).toBeUndefined();

      const admin = res.body.items.find((item: { id: string }) => item.id === adminId);
      expect(admin).toMatchObject({ role: 'ADMIN', projectCount: 0, aiGenerationCount: 0 });
    });

    it('searches email and full name case-insensitively', async () => {
      const byEmail = await request(server)
        .get(`${API}/admin/users`)
        .query({ search: 'DEMO@' })
        .set('Cookie', asAdmin())
        .expect(200);
      expect(byEmail.body.total).toBe(1);
      expect(byEmail.body.items[0].id).toBe(demoId);

      const byName = await request(server)
        .get(`${API}/admin/users`)
        .query({ search: 'karimov', pageSize: 5 })
        .set('Cookie', asAdmin())
        .expect(200);
      expect(byName.body).toMatchObject({ total: 1, pageSize: 5 });
      expect(byName.body.items[0].fullName).toBe(DEMO.fullName);
    });

    it('rejects a page size above the ceiling with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .get(`${API}/admin/users`)
        .query({ pageSize: 500 })
        .set('Cookie', asAdmin())
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('counts only projects that are not soft-deleted', async () => {
      const throwaway = await request(server)
        .post(`${API}/projects`)
        .set('Cookie', asDemo())
        .send({ name: 'Vaqtinchalik' })
        .expect(201);
      await request(server)
        .delete(`${API}/projects/${String(throwaway.body.id)}`)
        .set('Cookie', asDemo())
        .expect(204);

      const res = await request(server)
        .get(`${API}/admin/users`)
        .query({ search: DEMO.email })
        .set('Cookie', asAdmin())
        .expect(200);
      expect(res.body.items[0].projectCount).toBe(1);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('refuses to change your own account with 409 CANNOT_MODIFY_SELF', async () => {
      const res = await request(server)
        .patch(`${API}/admin/users/${adminId}`)
        .set('Cookie', asAdmin())
        .send({ isActive: false })
        .expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, code: 'CANNOT_MODIFY_SELF' });
      const admin = await prisma.user.findUnique({ where: { id: adminId } });
      expect(admin?.isActive).toBe(true);
    });

    it('refuses to touch another administrator with 409 CANNOT_MODIFY_ADMIN', async () => {
      const res = await request(server)
        .patch(`${API}/admin/users/${secondAdminId}`)
        .set('Cookie', asAdmin())
        .send({ isActive: false })
        .expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, code: 'CANNOT_MODIFY_ADMIN' });
      const other = await prisma.user.findUnique({ where: { id: secondAdminId } });
      expect(other?.isActive).toBe(true);
    });

    it('rejects an unknown user with 404 and a malformed body with 400', async () => {
      const missing = await request(server)
        .patch(`${API}/admin/users/does-not-exist`)
        .set('Cookie', asAdmin())
        .send({ isActive: false })
        .expect(404);
      expect(missing.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

      const malformed = await request(server)
        .patch(`${API}/admin/users/${demoId}`)
        .set('Cookie', asAdmin())
        .send({ isActive: 'no' })
        .expect(400);
      expect(malformed.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('deactivates a user, killing their sessions and their login', async () => {
      const res = await request(server)
        .patch(`${API}/admin/users/${demoId}`)
        .set('Cookie', asAdmin())
        .send({ isActive: false })
        .expect(200);

      expect(res.body).toMatchObject({ id: demoId, email: DEMO.email, isActive: false });

      const tokens = await prisma.refreshToken.findMany({ where: { userId: demoId } });
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every((token) => token.revokedAt !== null)).toBe(true);

      // The still-unexpired access cookie no longer buys anything — the guard
      // re-checks isActive on every request, so a normal data endpoint is cut
      // off immediately, not just the /users/me special case.
      const me = await request(server)
        .get(`${API}/users/me`)
        .set('Cookie', asDemo())
        .expect(401);
      expect(me.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });

      const projects = await request(server)
        .get(`${API}/projects`)
        .set('Cookie', asDemo())
        .expect(401);
      expect(projects.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });

      // … the refresh token cannot mint a new one …
      const refreshed = await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${demoRefreshToken}`)
        .expect(401);
      expect(refreshed.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });

      // … and the front door stays shut.
      const login = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: DEMO.email, password: DEMO.password })
        .expect(401);
      expect(login.body).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    });

    it('filters the list by status while the user is inactive', async () => {
      const inactive = await request(server)
        .get(`${API}/admin/users`)
        .query({ isActive: 'false' })
        .set('Cookie', asAdmin())
        .expect(200);
      expect(inactive.body.total).toBe(1);
      expect(inactive.body.items[0].id).toBe(demoId);

      const active = await request(server)
        .get(`${API}/admin/users`)
        .query({ isActive: 'true' })
        .set('Cookie', asAdmin())
        .expect(200);
      expect(active.body.total).toBe(2);
      expect(active.body.items.map((item: { id: string }) => item.id)).not.toContain(demoId);
    });

    it('reactivates the user without resurrecting the revoked sessions', async () => {
      const res = await request(server)
        .patch(`${API}/admin/users/${demoId}`)
        .set('Cookie', asAdmin())
        .send({ isActive: true })
        .expect(200);
      expect(res.body).toMatchObject({ id: demoId, isActive: true });

      const login = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: DEMO.email, password: DEMO.password })
        .expect(200);
      demoCookies = applyCookies(login);

      await request(server).get(`${API}/users/me`).set('Cookie', asDemo()).expect(200);

      // The token revoked on deactivation stays revoked.
      await request(server)
        .post(`${API}/auth/refresh`)
        .set('Cookie', `archai_refresh=${demoRefreshToken}`)
        .expect(401);
    });
  });

  describe('GET /admin/projects', () => {
    it('lists every user project with the owner email', async () => {
      const res = await request(server)
        .get(`${API}/admin/projects`)
        .set('Cookie', asAdmin())
        .expect(200);

      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(res.body.items[0]).toMatchObject({
        id: projectId,
        name: 'Oilaviy uy — Qibray',
        status: 'CONFIGURED',
        ownerEmail: DEMO.email,
        roomCount: 4,
        landAreaM2: 600,
      });
      expect(typeof res.body.items[0].updatedAt).toBe('string');
    });

    it('filters by name and status', async () => {
      const searched = await request(server)
        .get(`${API}/admin/projects`)
        .query({ search: 'qibray' })
        .set('Cookie', asAdmin())
        .expect(200);
      expect(searched.body.total).toBe(1);

      const drafts = await request(server)
        .get(`${API}/admin/projects`)
        .query({ status: 'DRAFT' })
        .set('Cookie', asAdmin())
        .expect(200);
      expect(drafts.body.total).toBe(0);
      expect(drafts.body.items).toEqual([]);
    });
  });

  describe('estimate rules', () => {
    it('lists the version history newest-first', async () => {
      const res = await request(server)
        .get(`${API}/admin/estimate-rules`)
        .set('Cookie', asAdmin())
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0]).toMatchObject({ id: rulesV1Id, version: '1', isActive: true });
      expect(res.body.items[0].data).toMatchObject({
        version: '1',
        currency: 'UZS',
        structureCostPerM2: ESTIMATE_RULES_V1.structureCostPerM2,
      });
    });

    it('activates a new version and reprices every estimate with it', async () => {
      const before = await structureOf();
      expect(before).toBe(1_041_040_000);

      const created = await request(server)
        .post(`${API}/admin/estimate-rules`)
        .set('Cookie', asAdmin())
        .send(RULES_V2)
        .expect(201);
      expect(created.body).toMatchObject({ version: '2', isActive: true });

      const history = await request(server)
        .get(`${API}/admin/estimate-rules`)
        .set('Cookie', asAdmin())
        .expect(200);
      expect(history.body.total).toBe(2);
      expect(history.body.items.map((item: { version: string }) => item.version)).toEqual(['2', '1']);
      expect(history.body.items.map((item: { isActive: boolean }) => item.isActive)).toEqual([
        true,
        false,
      ]);
      // The database constraint, not just the code, guarantees the single active row.
      expect(await prisma.estimateRule.count({ where: { isActive: true } })).toBe(1);

      const estimate = await request(server)
        .get(`${API}/projects/${projectId}/estimate`)
        .set('Cookie', asDemo())
        .expect(200);
      expect(estimate.body.estimate.rulesVersion).toBe('2');
      const structure = estimate.body.estimate.lines.find(
        (line: { key: string }) => line.key === 'structure',
      );
      expect(structure.amount).toBe(before * 2);
      expect(estimate.body.estimate.total).toBeGreaterThan(0);
    });

    it('rejects a duplicate version with 409 VERSION_EXISTS and changes nothing', async () => {
      const res = await request(server)
        .post(`${API}/admin/estimate-rules`)
        .set('Cookie', asAdmin())
        .send({ ...RULES_V2, structureCostPerM2: 1 })
        .expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, code: 'VERSION_EXISTS' });
      expect(await prisma.estimateRule.count()).toBe(2);
      const active = await prisma.estimateRule.findFirst({ where: { isActive: true } });
      expect(active?.version).toBe('2');
      expect(await structureOf()).toBe(2_082_080_000);
    });

    it('rejects an incomplete rule set with 400 VALIDATION_ERROR', async () => {
      const { structureCostPerM2: _dropped, ...withoutStructure } = RULES_V2;
      const res = await request(server)
        .post(`${API}/admin/estimate-rules`)
        .set('Cookie', asAdmin())
        .send({ ...withoutStructure, version: '3' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
      expect(await prisma.estimateRule.count()).toBe(2);
    });
  });

  describe('GET /admin/audit', () => {
    it('recorded every mutation with its actor, entity and metadata', async () => {
      const rows = await auditRows({ pageSize: '50' });
      const actionsOf = (action: string): AuditRow[] =>
        rows.filter((row) => row.action === action);

      const deactivate = actionsOf('user.deactivate');
      expect(deactivate).toHaveLength(1);
      expect(deactivate[0]).toMatchObject({
        entity: 'user',
        entityId: demoId,
        actorId: adminId,
        actorEmail: ADMIN.email,
      });
      expect(deactivate[0]?.metadata).toMatchObject({ email: DEMO.email });

      const activate = actionsOf('user.activate');
      expect(activate).toHaveLength(1);
      expect(activate[0]).toMatchObject({
        entity: 'user',
        entityId: demoId,
        actorId: adminId,
      });

      const rules = actionsOf('estimate-rules.activate');
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({ entity: 'estimate-rule', actorId: adminId });
      expect(rules[0]?.metadata).toMatchObject({ version: '2', previousVersion: '1' });
      const activeRule = await prisma.estimateRule.findFirst({ where: { isActive: true } });
      expect(rules[0]?.entityId).toBe(activeRule?.id);

      // Newest first, and no failed attempt was ever recorded.
      const timestamps = rows.map((row) => Date.parse(row.createdAt));
      expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
      expect(actionsOf('user.activate').length + actionsOf('user.deactivate').length).toBe(2);
    });

    it('recorded the cross-user reads once per request', async () => {
      // One row per request: the plain list plus the two filtered ones.
      const projectReads = await auditRows({ action: 'projects.list', pageSize: '50' });
      expect(projectReads).toHaveLength(3);
      expect(projectReads[0]).toMatchObject({
        entity: 'project',
        entityId: null,
        actorId: adminId,
        actorEmail: ADMIN.email,
      });

      const userReads = await auditRows({ action: 'users.list', pageSize: '50' });
      expect(userReads.length).toBeGreaterThan(0);
      expect(userReads[0]).toMatchObject({ action: 'users.list', entity: 'user', actorId: adminId });
      expect(userReads[0]?.metadata).toMatchObject({ page: 1, pageSize: 20 });

      // Reading the trail is not itself an audited action.
      const auditReads = await prisma.auditLog.count({ where: { action: { startsWith: 'audit' } } });
      expect(auditReads).toBe(0);
      // Neither are the estimate-rules reads.
      expect(
        await prisma.auditLog.count({ where: { action: 'estimate-rules.list' } }),
      ).toBe(0);
    });

    it('filters by action prefix and by actor', async () => {
      const mutations = await auditRows({ action: 'user.' });
      expect(mutations).toHaveLength(2);
      expect(mutations.map((row) => row.action).sort()).toEqual([
        'user.activate',
        'user.deactivate',
      ]);

      const byActor = await auditRows({ actorId: adminId, pageSize: '50' });
      expect(byActor.length).toBeGreaterThan(0);
      expect(byActor.every((row) => row.actorId === adminId)).toBe(true);

      const other = await auditRows({ actorId: demoId });
      expect(other).toEqual([]);
    });

    it('keeps the trail when the acting administrator is deleted', async () => {
      const disposable = await prisma.user.create({
        data: {
          email: 'ex-admin@archai.uz',
          passwordHash: 'not-a-real-hash',
          fullName: 'Ex Administrator',
          role: 'ADMIN',
        },
      });
      const row = await prisma.auditLog.create({
        data: { actorId: disposable.id, action: 'users.list', entity: 'user' },
      });

      await prisma.user.delete({ where: { id: disposable.id } });

      const kept = await prisma.auditLog.findUnique({ where: { id: row.id } });
      expect(kept).not.toBeNull();
      expect(kept?.actorId).toBeNull();

      const listed = (await auditRows({ pageSize: '50' })).find((item) => item.id === row.id);
      expect(listed).toMatchObject({ actorId: null, actorEmail: null, action: 'users.list' });

      await prisma.auditLog.delete({ where: { id: row.id } });
    });
  });
});
