import { type INestApplication } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { FLOOR_PLAN_ENGINE_VERSION } from '@archai/floor-plan-engine';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GENERATE_RATE_LIMIT } from '../src/common/throttle.constants';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  API,
  cookieHeader,
  type Cookies,
  createTestApp,
  httpServer,
  registerUser,
  resetDatabase,
} from './utils/test-app';

const OWNER = {
  email: 'plan-owner@archai.uz',
  password: 'Passw0rd1',
  fullName: 'Plan Owner',
};
const INTRUDER = {
  email: 'plan-intruder@archai.uz',
  password: 'Passw0rd2',
  fullName: 'Nosy Neighbour',
};

const VALID_CONFIG = {
  land: { areaM2: 600, widthM: 20, lengthM: 30 },
  house: { widthM: 11, lengthM: 13, floorCount: 2, style: 'MODERN' },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0, widthM: 5.5, lengthM: 6 },
    { type: 'KITCHEN', floor: 0, widthM: 3.5, lengthM: 4.5 },
    { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4.5, label: 'Master' },
  ],
  features: { garage: true },
};

/**
 * Passes schema + domain validation (footprint well inside the land, no sized
 * rooms) but the engine cannot lay it out: a 4×4 m plate leaves a 3.4 m usable
 * band, which fits 2 rooms at the 1.5 m minimum side — not 6.
 */
const UNBUILDABLE_CONFIG = {
  house: { widthM: 4, lengthM: 4, floorCount: 1 },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0 },
    { type: 'KITCHEN', floor: 0 },
    { type: 'BATHROOM', floor: 0 },
    { type: 'BEDROOM', floor: 0 },
    { type: 'BEDROOM', floor: 0 },
    { type: 'OFFICE', floor: 0 },
  ],
};

interface PlanShape {
  engineVersion: string;
  house: { widthM: number; lengthM: number; floorCount: number };
  floors: {
    index: number;
    outline: { x: number; y: number; width: number; height: number };
    rooms: { key: string; rect: { width: number; height: number } }[];
    walls: unknown[];
    doors: unknown[];
  }[];
}

function roomKeys(plan: PlanShape): string[] {
  return plan.floors.flatMap((floor) => floor.rooms.map((room) => room.key));
}

describe('Floor plan (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let ownerCookies: Cookies = {};
  let intruderCookies: Cookies = {};
  let projectId = '';
  let draftId = '';
  let firstPlan: PlanShape | null = null;
  let firstGeneratedAt = '';

  const asOwner = (): string => cookieHeader(ownerCookies);
  const asIntruder = (): string => cookieHeader(intruderCookies);
  const planUrl = (id: string): string => `${API}/projects/${id}/floor-plan`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);

    ownerCookies = (await registerUser(server, OWNER)).cookies;
    intruderCookies = (await registerUser(server, INTRUDER)).cookies;

    const created = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name: 'Reja loyihasi' })
      .expect(201);
    projectId = String(created.body.id);

    const draft = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name: 'Qoralama' })
      .expect(201);
    draftId = String(draft.body.id);
  });

  // Generation is capped at 30/min/IP, and the throttle test below fires more than
  // that in a tight loop — so each test starts from an empty bucket, as PDF does.
  beforeEach(() => {
    const storage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    storage.storage.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    const res = await request(server).get(planUrl(projectId)).expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('rejects an unconfigured project with 409 PROJECT_NOT_CONFIGURED', async () => {
    const res = await request(server).get(planUrl(draftId)).set('Cookie', asOwner()).expect(409);

    expect(res.body).toMatchObject({ statusCode: 409, code: 'PROJECT_NOT_CONFIGURED' });
    const stored = await prisma.floorPlan.findUnique({ where: { projectId: draftId } });
    expect(stored).toBeNull();
  });

  it('hides another users project behind 404', async () => {
    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send(VALID_CONFIG)
      .expect(200);

    const res = await request(server)
      .get(planUrl(projectId))
      .set('Cookie', asIntruder())
      .expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    const stored = await prisma.floorPlan.findUnique({ where: { projectId } });
    expect(stored).toBeNull();
  });

  it('generates and persists a plan for a configured project', async () => {
    const project = await request(server)
      .get(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .expect(200);
    const configuredRoomIds: string[] = project.body.rooms.map((room: { id: string }) => room.id);
    expect(configuredRoomIds).toHaveLength(4);

    const res = await request(server).get(planUrl(projectId)).set('Cookie', asOwner()).expect(200);

    const plan = res.body.plan as PlanShape;
    expect(plan.engineVersion).toBe(FLOOR_PLAN_ENGINE_VERSION);
    expect(plan.house).toEqual({ widthM: 11, lengthM: 13, floorCount: 2 });
    expect(plan.floors).toHaveLength(VALID_CONFIG.house.floorCount);
    expect(plan.floors.map((floor) => floor.index)).toEqual([0, 1]);

    // Every configured room reaches the geometry under its database id.
    expect(roomKeys(plan).sort()).toEqual([...configuredRoomIds].sort());

    const ground = plan.floors[0];
    expect(ground).toBeDefined();
    expect(ground?.rooms.length).toBeGreaterThan(0);
    expect(ground?.outline.width).toBeGreaterThan(0);
    expect(ground?.outline.height).toBeGreaterThan(0);
    expect(ground?.walls.length).toBeGreaterThan(0);
    expect(ground?.doors.length).toBeGreaterThan(0);
    for (const room of ground?.rooms ?? []) {
      expect(room.rect.width).toBeGreaterThan(0);
      expect(room.rect.height).toBeGreaterThan(0);
    }

    expect(typeof res.body.generatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(String(res.body.generatedAt)))).toBe(false);

    const stored = await prisma.floorPlan.findUnique({ where: { projectId } });
    expect(stored).not.toBeNull();
    expect(stored?.engineVersion).toBe(FLOOR_PLAN_ENGINE_VERSION);
    expect(stored?.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.generatedAt.toISOString()).toBe(res.body.generatedAt);

    firstPlan = plan;
    firstGeneratedAt = String(res.body.generatedAt);
  });

  it('serves the stored plan on repeat requests without regenerating', async () => {
    const res = await request(server).get(planUrl(projectId)).set('Cookie', asOwner()).expect(200);

    expect(res.body.generatedAt).toBe(firstGeneratedAt);
    expect(res.body.plan).toEqual(firstPlan);

    const stored = await prisma.floorPlan.findUnique({ where: { projectId } });
    expect(stored?.generatedAt.toISOString()).toBe(firstGeneratedAt);
  });

  it('regenerates when the configuration changes', async () => {
    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ house: { widthM: 11, lengthM: 15, floorCount: 2, style: 'MODERN' } })
      .expect(200);

    const res = await request(server).get(planUrl(projectId)).set('Cookie', asOwner()).expect(200);

    expect(res.body.generatedAt).not.toBe(firstGeneratedAt);
    expect(res.body.plan).not.toEqual(firstPlan);
    expect((res.body.plan as PlanShape).house).toEqual({
      widthM: 11,
      lengthM: 15,
      floorCount: 2,
    });

    const stored = await prisma.floorPlan.findUnique({ where: { projectId } });
    expect(stored?.generatedAt.toISOString()).toBe(res.body.generatedAt);
  });

  it('returns 422 FLOOR_PLAN_UNAVAILABLE and drops the stale plan', async () => {
    const before = await prisma.floorPlan.findUnique({ where: { projectId } });
    expect(before).not.toBeNull();

    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send(UNBUILDABLE_CONFIG)
      .expect(200);

    const res = await request(server).get(planUrl(projectId)).set('Cookie', asOwner()).expect(422);

    expect(res.body).toMatchObject({ statusCode: 422, code: 'FLOOR_PLAN_UNAVAILABLE' });
    const issues = res.body.details.issues as { code: string }[];
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
    // The feasibility gate (engine 1.2.0) rejects the overload before the band
    // layout runs, with machine-readable adjustment suggestions.
    expect(issues.map((issue) => issue.code)).toContain('INFEASIBLE_REQUIREMENTS');
    expect(res.body.details.suggestions).toContain('increase_footprint');

    // A rejected configuration must not leave geometry from the previous one behind.
    const after = await prisma.floorPlan.findUnique({ where: { projectId } });
    expect(after).toBeNull();
  });

  it('regenerates once the configuration is buildable again', async () => {
    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ house: VALID_CONFIG.house, rooms: VALID_CONFIG.rooms })
      .expect(200);

    const res = await request(server).get(planUrl(projectId)).set('Cookie', asOwner()).expect(200);

    const plan = res.body.plan as PlanShape;
    expect(plan.floors).toHaveLength(2);
    expect(roomKeys(plan)).toHaveLength(VALID_CONFIG.rooms.length);

    const stored = await prisma.floorPlan.findUnique({ where: { projectId } });
    expect(stored?.generatedAt.toISOString()).toBe(res.body.generatedAt);
  });

  it('returns 404 for a project id containing a NUL byte', async () => {
    // A control byte in the id can crash the Prisma driver; IdParamPipe turns it
    // into an ordinary "not found" before the request reaches the service.
    const res = await request(server)
      .get(`${API}/projects/%00/floor-plan`)
      .set('Cookie', asOwner())
      .expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('throttles floor-plan generation to thirty per minute per IP', async () => {
    // The suite left projectId buildable, so every request under the cap succeeds.
    for (let attempt = 0; attempt < GENERATE_RATE_LIMIT; attempt++) {
      await request(server).get(planUrl(projectId)).set('Cookie', asOwner()).expect(200);
    }

    const res = await request(server).get(planUrl(projectId)).set('Cookie', asOwner()).expect(429);
    expect(res.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });
});
