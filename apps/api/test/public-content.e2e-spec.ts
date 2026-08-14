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
  registerUser,
  resetDatabase,
} from './utils/test-app';

const ADMIN = {
  email: 'content-admin@archai.uz',
  password: 'Admin1234!',
  fullName: 'Content Administrator',
};
const DEMO = {
  email: 'content-demo@archai.uz',
  password: 'Demo1234!',
  fullName: 'Content Demo',
};

interface AuditRow {
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
}

describe('Public content (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let adminCookies: Cookies = {};
  let demoCookies: Cookies = {};
  let adminId = '';

  const asAdmin = (): string => cookieHeader(adminCookies);
  const asDemo = (): string => cookieHeader(demoCookies);

  const auditRows = async (action: string): Promise<AuditRow[]> => {
    const res = await request(server)
      .get(`${API}/admin/audit`)
      .query({ action, pageSize: '50' })
      .set('Cookie', asAdmin())
      .expect(200);
    return res.body.items as AuditRow[];
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);

    // Registration always creates a USER; promote in the DB, then take a session.
    const registeredAdmin = await registerUser(server, ADMIN);
    adminId = registeredAdmin.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    const adminLogin = await request(server)
      .post(`${API}/auth/login`)
      .send({ email: ADMIN.email, password: ADMIN.password })
      .expect(200);
    adminCookies = applyCookies(adminLogin);

    demoCookies = (await registerUser(server, DEMO)).cookies;

    // ── Public-visibility fixtures, inserted directly for precise state ──────
    await prisma.faqItem.createMany({
      data: [
        { question: 'Umumiy-0', answer: 'a', category: 'Umumiy', sortOrder: 0, isPublished: true },
        { question: 'Umumiy-1', answer: 'a', category: 'Umumiy', sortOrder: 1, isPublished: true },
        { question: 'Narx-0', answer: 'a', category: 'Narx', sortOrder: 0, isPublished: true },
        { question: 'Hidden', answer: 'a', category: 'Umumiy', sortOrder: 2, isPublished: false },
      ],
    });

    await prisma.blogPost.createMany({
      data: [
        {
          slug: 'published-one',
          title: 'Published One',
          excerpt: 'first',
          body: '# One\n\nBody one.',
          authorName: 'ArchAI',
          category: 'Rejalashtirish',
          tags: ['reja', 'boshlovchi'],
          status: 'PUBLISHED',
          publishedAt: new Date('2026-07-01T00:00:00.000Z'),
        },
        {
          slug: 'published-two',
          title: 'Published Two',
          excerpt: 'second',
          body: '# Two\n\nBody two.',
          authorName: 'ArchAI',
          category: 'Smeta',
          tags: ['smeta'],
          status: 'PUBLISHED',
          publishedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        {
          slug: 'draft-post',
          title: 'Draft Post',
          excerpt: 'hidden',
          body: '# Draft',
          authorName: 'ArchAI',
          status: 'DRAFT',
        },
      ],
    });

    await prisma.pricingPlan.createMany({
      data: [
        {
          key: 'FREE',
          name: 'Bepul',
          tagline: 'Hozircha bepul',
          priceMonthly: 0,
          limits: { projects: 3, aiParsesPerMonth: 10, pdfExportsPerMonth: 10, storageMb: 200 },
          features: ['a'],
          sortOrder: 0,
          isActive: true,
        },
        {
          key: 'PRO',
          name: 'Pro',
          tagline: 'Professional',
          priceMonthly: 299_000,
          limits: {
            projects: null,
            aiParsesPerMonth: null,
            pdfExportsPerMonth: null,
            storageMb: 20_000,
          },
          features: ['a', 'b'],
          sortOrder: 2,
          isActive: true,
        },
        {
          key: 'OLD',
          name: 'Retired',
          tagline: 'gone',
          priceMonthly: 50_000,
          limits: { projects: 1, aiParsesPerMonth: 1, pdfExportsPerMonth: 1, storageMb: 1 },
          features: [],
          sortOrder: 9,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Public FAQ ────────────────────────────────────────────────────────────

  describe('GET /faq', () => {
    it('returns published items only, ordered by (category, sortOrder), no auth', async () => {
      const res = await request(server).get(`${API}/faq`).expect(200);
      expect(res.body.items.map((item: { question: string }) => item.question)).toEqual([
        'Narx-0',
        'Umumiy-0',
        'Umumiy-1',
      ]);
      expect(res.body.items.every((item: { question: string }) => item.question !== 'Hidden')).toBe(
        true,
      );
      // Public shape carries no admin-only fields.
      expect(res.body.items[0].isPublished).toBeUndefined();
      expect(res.body.items[0]).toMatchObject({ question: 'Narx-0', category: 'Narx', sortOrder: 0 });
    });

    it('is not audited (public reads leave no trail)', async () => {
      await request(server).get(`${API}/faq`).expect(200);
      expect(await prisma.auditLog.count({ where: { action: 'faq.list' } })).toBe(0);
    });
  });

  // ── Public pricing ──────────────────────────────────────────────────────

  describe('GET /pricing', () => {
    it('returns active plans wrapped as { plans, beta: true }, ordered', async () => {
      const res = await request(server).get(`${API}/pricing`).expect(200);
      expect(res.body.beta).toBe(true);
      expect(res.body.plans.map((plan: { key: string }) => plan.key)).toEqual(['FREE', 'PRO']);
      const free = res.body.plans[0];
      expect(free).toMatchObject({ key: 'FREE', priceMonthly: 0, currency: 'UZS' });
      expect(free.limits).toMatchObject({ projects: 3, storageMb: 200 });
      // Unlimited is preserved as null, not dropped.
      expect(res.body.plans[1].limits.projects).toBeNull();
      // The inactive plan is invisible.
      expect(res.body.plans.some((plan: { key: string }) => plan.key === 'OLD')).toBe(false);
    });
  });

  // ── Public blog list ──────────────────────────────────────────────────────

  describe('GET /blog', () => {
    it('lists published posts newest first, drafts excluded', async () => {
      const res = await request(server).get(`${API}/blog`).expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 12 });
      expect(res.body.items.map((post: { slug: string }) => post.slug)).toEqual([
        'published-two',
        'published-one',
      ]);
      expect(res.body.items.some((post: { slug: string }) => post.slug === 'draft-post')).toBe(
        false,
      );
      // List item omits the body.
      expect(res.body.items[0].body).toBeUndefined();
    });

    it('filters by category and by tag', async () => {
      const byCategory = await request(server)
        .get(`${API}/blog`)
        .query({ category: 'Smeta' })
        .expect(200);
      expect(byCategory.body.total).toBe(1);
      expect(byCategory.body.items[0].slug).toBe('published-two');

      const byTag = await request(server).get(`${API}/blog`).query({ tag: 'reja' }).expect(200);
      expect(byTag.body.total).toBe(1);
      expect(byTag.body.items[0].slug).toBe('published-one');
    });
  });

  // ── Public blog by slug ─────────────────────────────────────────────────

  describe('GET /blog/:slug', () => {
    it('returns a published post with its markdown body', async () => {
      const res = await request(server).get(`${API}/blog/published-one`).expect(200);
      expect(res.body).toMatchObject({ slug: 'published-one', title: 'Published One' });
      expect(res.body.body).toContain('# One');
    });

    it('404s a draft slug', async () => {
      const res = await request(server).get(`${API}/blog/draft-post`).expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });

    it('404s an unknown slug', async () => {
      const res = await request(server).get(`${API}/blog/does-not-exist`).expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });

  // ── Admin access control ────────────────────────────────────────────────

  describe('admin access control', () => {
    it('requires authentication (401)', async () => {
      for (const path of ['faq', 'blog', 'pricing']) {
        const res = await request(server).get(`${API}/admin/${path}`).expect(401);
        expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
      }
    });

    it('answers 403 for a USER on reads and mutations', async () => {
      const routes = [
        (): request.Test => request(server).get(`${API}/admin/faq`),
        (): request.Test => request(server).post(`${API}/admin/faq`).send({ question: 'x', answer: 'y' }),
        (): request.Test => request(server).get(`${API}/admin/blog`),
        (): request.Test => request(server).get(`${API}/admin/pricing`),
      ];
      for (const route of routes) {
        const res = await route().set('Cookie', asDemo()).expect(403);
        expect(res.body).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      }
    });
  });

  // ── Admin FAQ CRUD ────────────────────────────────────────────────────────

  describe('admin FAQ CRUD', () => {
    let faqId = '';

    it('creates, lists (all incl. hidden), updates and deletes a FAQ item', async () => {
      const created = await request(server)
        .post(`${API}/admin/faq`)
        .set('Cookie', asAdmin())
        .send({ question: 'Admin FAQ', answer: 'answer', category: 'Umumiy', isPublished: false })
        .expect(201);
      faqId = String(created.body.id);
      expect(created.body).toMatchObject({ question: 'Admin FAQ', isPublished: false });

      // Admin list includes the unpublished ones the public never sees.
      const list = await request(server).get(`${API}/admin/faq`).set('Cookie', asAdmin()).expect(200);
      expect(list.body.items.some((item: { id: string }) => item.id === faqId)).toBe(true);
      expect(list.body.items.some((item: { question: string }) => item.question === 'Hidden')).toBe(
        true,
      );

      const updated = await request(server)
        .patch(`${API}/admin/faq/${faqId}`)
        .set('Cookie', asAdmin())
        .send({ isPublished: true, sortOrder: 5 })
        .expect(200);
      expect(updated.body).toMatchObject({ isPublished: true, sortOrder: 5 });

      await request(server)
        .delete(`${API}/admin/faq/${faqId}`)
        .set('Cookie', asAdmin())
        .expect(204);
      expect(await prisma.faqItem.findUnique({ where: { id: faqId } })).toBeNull();
    });

    it('404s an update to an unknown id', async () => {
      const res = await request(server)
        .patch(`${API}/admin/faq/does-not-exist`)
        .set('Cookie', asAdmin())
        .send({ isPublished: true })
        .expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });

    it('wrote faq.create / faq.update / faq.delete audit rows', async () => {
      for (const action of ['faq.create', 'faq.update', 'faq.delete']) {
        const rows = await auditRows(action);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]).toMatchObject({ entity: 'faq', actorId: adminId });
      }
    });
  });

  // ── Admin blog CRUD (slug conflict + publish transition) ──────────────────

  describe('admin blog CRUD', () => {
    let postId = '';

    it('creates a draft, then publishing stamps publishedAt', async () => {
      const created = await request(server)
        .post(`${API}/admin/blog`)
        .set('Cookie', asAdmin())
        .send({
          slug: 'admin-draft',
          title: 'Admin Draft',
          excerpt: 'ex',
          body: '# Draft body',
          authorName: 'ArchAI',
          tags: ['x'],
        })
        .expect(201);
      postId = String(created.body.id);
      expect(created.body).toMatchObject({ status: 'DRAFT', publishedAt: null });

      // Draft is invisible to the public.
      await request(server).get(`${API}/blog/admin-draft`).expect(404);

      const published = await request(server)
        .patch(`${API}/admin/blog/${postId}`)
        .set('Cookie', asAdmin())
        .send({ status: 'PUBLISHED' })
        .expect(200);
      expect(published.body.status).toBe('PUBLISHED');
      expect(published.body.publishedAt).not.toBeNull();
      expect(typeof published.body.publishedAt).toBe('string');

      // Now the public can read it.
      const publicView = await request(server).get(`${API}/blog/admin-draft`).expect(200);
      expect(publicView.body.body).toContain('# Draft body');
    });

    it('rejects a duplicate slug with 409 SLUG_EXISTS', async () => {
      const res = await request(server)
        .post(`${API}/admin/blog`)
        .set('Cookie', asAdmin())
        .send({
          slug: 'published-one',
          title: 'Clash',
          excerpt: 'ex',
          body: 'x',
          authorName: 'ArchAI',
        })
        .expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, code: 'SLUG_EXISTS' });
    });

    it('deletes a post', async () => {
      await request(server)
        .delete(`${API}/admin/blog/${postId}`)
        .set('Cookie', asAdmin())
        .expect(204);
      expect(await prisma.blogPost.findUnique({ where: { id: postId } })).toBeNull();
    });

    it('stamped the publish and recorded blog.publish (distinct from blog.update)', async () => {
      const publishRows = await auditRows('blog.publish');
      expect(publishRows.length).toBe(1);
      expect(publishRows[0]).toMatchObject({ entity: 'blog-post', actorId: adminId });

      const createRows = await auditRows('blog.create');
      expect(createRows.length).toBeGreaterThan(0);
      const deleteRows = await auditRows('blog.delete');
      expect(deleteRows.length).toBeGreaterThan(0);
    });
  });

  // ── Admin pricing CRUD ────────────────────────────────────────────────────

  describe('admin pricing CRUD', () => {
    let planId = '';

    it('creates a plan, rejects a duplicate key, updates and deactivates it', async () => {
      const created = await request(server)
        .post(`${API}/admin/pricing`)
        .set('Cookie', asAdmin())
        .send({
          key: 'TEAM',
          name: 'Team',
          tagline: 'For teams',
          priceMonthly: 500_000,
          limits: { projects: 100, aiParsesPerMonth: 500, pdfExportsPerMonth: 500, storageMb: 5000 },
          features: ['a'],
          sortOrder: 3,
        })
        .expect(201);
      planId = String(created.body.id);
      expect(created.body).toMatchObject({ key: 'TEAM', isActive: true });

      const dup = await request(server)
        .post(`${API}/admin/pricing`)
        .set('Cookie', asAdmin())
        .send({
          key: 'TEAM',
          name: 'Team 2',
          tagline: 'dup',
          priceMonthly: 1,
          limits: { projects: 1, aiParsesPerMonth: 1, pdfExportsPerMonth: 1, storageMb: 1 },
        })
        .expect(409);
      expect(dup.body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });

      const updated = await request(server)
        .patch(`${API}/admin/pricing/${planId}`)
        .set('Cookie', asAdmin())
        .send({ priceMonthly: 450_000 })
        .expect(200);
      expect(updated.body.priceMonthly).toBe(450_000);

      // Appears publicly while active …
      const before = await request(server).get(`${API}/pricing`).expect(200);
      expect(before.body.plans.some((plan: { key: string }) => plan.key === 'TEAM')).toBe(true);

      await request(server)
        .post(`${API}/admin/pricing/${planId}/deactivate`)
        .set('Cookie', asAdmin())
        .expect(200);

      // … and is gone once deactivated.
      const after = await request(server).get(`${API}/pricing`).expect(200);
      expect(after.body.plans.some((plan: { key: string }) => plan.key === 'TEAM')).toBe(false);
    });

    it('wrote pricing.create / pricing.update / pricing.deactivate audit rows', async () => {
      for (const action of ['pricing.create', 'pricing.update', 'pricing.deactivate']) {
        const rows = await auditRows(action);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]).toMatchObject({ entity: 'pricing-plan', actorId: adminId });
      }
    });
  });

  // ── Cross-content list reads are audited ─────────────────────────────────

  describe('admin list reads are audited', () => {
    it('records faq.list / blog.list / pricing.list', async () => {
      await request(server).get(`${API}/admin/faq`).set('Cookie', asAdmin()).expect(200);
      await request(server).get(`${API}/admin/blog`).set('Cookie', asAdmin()).expect(200);
      await request(server).get(`${API}/admin/pricing`).set('Cookie', asAdmin()).expect(200);

      for (const action of ['faq.list', 'blog.list', 'pricing.list']) {
        const rows = await auditRows(action);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]?.actorId).toBe(adminId);
      }
    });
  });
});
