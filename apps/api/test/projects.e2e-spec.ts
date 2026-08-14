import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  email: 'owner@archai.uz',
  password: 'Passw0rd1',
  fullName: 'Project Owner',
};
const INTRUDER = {
  email: 'intruder@archai.uz',
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
  features: { garage: true, terrace: true },
};

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let ownerCookies: Cookies = {};
  let intruderCookies: Cookies = {};
  let projectId = '';

  const asOwner = (): string => cookieHeader(ownerCookies);
  const asIntruder = (): string => cookieHeader(intruderCookies);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);

    ownerCookies = (await registerUser(server, OWNER)).cookies;
    intruderCookies = (await registerUser(server, INTRUDER)).cookies;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    const res = await request(server).get(`${API}/projects`).expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('creates a project in DRAFT', async () => {
    const res = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name: 'Oilaviy uy', description: 'Test loyiha' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Oilaviy uy',
      description: 'Test loyiha',
      status: 'DRAFT',
      land: null,
      house: null,
      rooms: [],
    });
    expect(res.body.features).toEqual({
      garage: false,
      terrace: false,
      balcony: false,
      pool: false,
      garden: false,
    });
    expect(res.body.validation).toMatchObject({ valid: true, errors: [] });

    projectId = String(res.body.id);
  });

  it('rejects an invalid create payload with 400 VALIDATION_ERROR', async () => {
    const res = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name: 'x' })
      .expect(400);

    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('lists own projects with the paginated shape', async () => {
    await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name: 'Dala hovli' })
      .expect(201);

    const res = await request(server)
      .get(`${API}/projects`)
      .set('Cookie', asOwner())
      .expect(200);

    expect(res.body).toMatchObject({ page: 1, pageSize: 12, total: 2 });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      name: 'Dala hovli',
      status: 'DRAFT',
      landAreaM2: null,
      floorCount: null,
      style: null,
      roomCount: 0,
    });

    const searched = await request(server)
      .get(`${API}/projects`)
      .query({ search: 'oilaviy', pageSize: 1 })
      .set('Cookie', asOwner())
      .expect(200);

    expect(searched.body.total).toBe(1);
    expect(searched.body.pageSize).toBe(1);
    expect(searched.body.items[0].name).toBe('Oilaviy uy');
  });

  it('does not leak other users projects', async () => {
    const res = await request(server)
      .get(`${API}/projects`)
      .set('Cookie', asIntruder())
      .expect(200);

    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it('applies a valid configuration, persists rooms in order and flips to CONFIGURED', async () => {
    const res = await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send(VALID_CONFIG)
      .expect(200);

    expect(res.body.status).toBe('CONFIGURED');
    expect(res.body.land).toEqual({ areaM2: 600, widthM: 20, lengthM: 30 });
    expect(res.body.house).toEqual({ widthM: 11, lengthM: 13, floorCount: 2, style: 'MODERN' });
    expect(res.body.features).toMatchObject({ garage: true, terrace: true, pool: false });
    expect(res.body.rooms.map((room: { type: string }) => room.type)).toEqual([
      'LIVING_ROOM',
      'KITCHEN',
      'BATHROOM',
      'BEDROOM',
    ]);
    expect(res.body.rooms[3]).toMatchObject({ floor: 1, label: 'Master' });
    expect(res.body.validation.valid).toBe(true);

    const stored = await prisma.room.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
    expect(stored.map((room) => room.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(stored.map((room) => room.type)).toEqual([
      'LIVING_ROOM',
      'KITCHEN',
      'BATHROOM',
      'BEDROOM',
    ]);
  });

  it('rejects a house bigger than the land with 422 and persists nothing', async () => {
    const res = await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ name: 'Should not be saved', house: { widthM: 60, lengthM: 60, floorCount: 2 } })
      .expect(422);

    expect(res.body).toMatchObject({ statusCode: 422, code: 'DOMAIN_VALIDATION_ERROR' });
    expect(Array.isArray(res.body.details.errors)).toBe(true);
    expect(res.body.details.errors.map((issue: { code: string }) => issue.code)).toContain(
      'HOUSE_EXCEEDS_LAND',
    );

    const unchanged = await request(server)
      .get(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .expect(200);

    expect(unchanged.body.name).toBe('Oilaviy uy');
    expect(unchanged.body.house).toEqual({
      widthM: 11,
      lengthM: 13,
      floorCount: 2,
      style: 'MODERN',
    });
    expect(unchanged.body.status).toBe('CONFIGURED');
  });

  it('rejects a schema-invalid configuration with 400', async () => {
    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ house: { widthM: 11, lengthM: 13, floorCount: 9 } })
      .expect(400);
  });

  it('hides the project from other users behind 404', async () => {
    const get = await request(server)
      .get(`${API}/projects/${projectId}`)
      .set('Cookie', asIntruder())
      .expect(404);
    expect(get.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asIntruder())
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(server)
      .delete(`${API}/projects/${projectId}`)
      .set('Cookie', asIntruder())
      .expect(404);

    const stillThere = await prisma.project.findUnique({ where: { id: projectId } });
    expect(stillThere?.deletedAt).toBeNull();
    expect(stillThere?.name).toBe('Oilaviy uy');
  });

  it('duplicates a project including its rooms', async () => {
    const res = await request(server)
      .post(`${API}/projects/${projectId}/duplicate`)
      .set('Cookie', asOwner())
      .expect(201);

    expect(res.body.id).not.toBe(projectId);
    expect(res.body.name).toBe('Oilaviy uy (nusxa)');
    expect(res.body.status).toBe('CONFIGURED');
    expect(res.body.rooms).toHaveLength(4);
    expect(res.body.rooms.map((room: { type: string }) => room.type)).toEqual([
      'LIVING_ROOM',
      'KITCHEN',
      'BATHROOM',
      'BEDROOM',
    ]);

    const original = await request(server)
      .get(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .expect(200);
    const originalRoomIds = original.body.rooms.map((room: { id: string }) => room.id);
    const copyRoomIds = res.body.rooms.map((room: { id: string }) => room.id);
    expect(copyRoomIds.some((id: string) => originalRoomIds.includes(id))).toBe(false);
  });

  it('archives, blocks updates, then unarchives back to CONFIGURED', async () => {
    const archived = await request(server)
      .post(`${API}/projects/${projectId}/archive`)
      .set('Cookie', asOwner())
      .expect(200);
    expect(archived.body.status).toBe('ARCHIVED');

    const blocked = await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ name: 'Nope' })
      .expect(409);
    expect(blocked.body).toMatchObject({ statusCode: 409, code: 'PROJECT_ARCHIVED' });

    const unarchived = await request(server)
      .post(`${API}/projects/${projectId}/unarchive`)
      .set('Cookie', asOwner())
      .expect(200);
    expect(unarchived.body.status).toBe('CONFIGURED');
    expect(unarchived.body.rooms).toHaveLength(4);
  });

  it('drops back to DRAFT when the configuration stops being complete', async () => {
    const res = await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ rooms: [] })
      .expect(200);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.rooms).toEqual([]);

    const restored = await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ rooms: VALID_CONFIG.rooms })
      .expect(200);
    expect(restored.body.status).toBe('CONFIGURED');
  });

  it('soft-deletes a project so it disappears from list and detail', async () => {
    await request(server)
      .delete(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .expect(204);

    await request(server)
      .get(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .expect(404);

    const list = await request(server)
      .get(`${API}/projects`)
      .set('Cookie', asOwner())
      .expect(200);
    const ids = list.body.items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(projectId);

    const row = await prisma.project.findUnique({ where: { id: projectId } });
    expect(row?.deletedAt).not.toBeNull();

    await request(server)
      .delete(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .expect(404);
  });
});
