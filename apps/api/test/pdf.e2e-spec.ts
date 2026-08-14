import { type INestApplication } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ESTIMATE_RULES_V1 } from '../prisma/estimate-rules.v1';
import { PDF_EXPORT_RATE_LIMIT } from '../src/pdf/pdf.constants';
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
  email: 'pdf-owner@archai.uz',
  password: 'Passw0rd1',
  fullName: 'Hasan Sobirov',
};
const INTRUDER = {
  email: 'pdf-intruder@archai.uz',
  password: 'Passw0rd2',
  fullName: 'Nosy Neighbour',
};

/** Shape of the seeded demo project: 600 m² land, 11×13 m house, 2 floors. */
const VALID_CONFIG = {
  land: { areaM2: 600, widthM: 20, lengthM: 30 },
  house: { widthM: 11, lengthM: 13, floorCount: 2, style: 'MODERN' },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0, widthM: 5.5, lengthM: 6 },
    { type: 'KITCHEN', floor: 0, widthM: 3.5, lengthM: 4.5 },
    { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4.5, label: 'Master' },
  ],
  features: { garage: true, terrace: true, garden: true },
};

/** Eight rooms over two floors — a full report with both floor plans drawn. */
const FAMILY_CONFIG = {
  land: { areaM2: 800, widthM: 20, lengthM: 40 },
  house: { widthM: 12, lengthM: 14, floorCount: 2, style: 'TRADITIONAL' },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0, widthM: 5.5, lengthM: 6, label: 'Mehmonxona' },
    { type: 'KITCHEN', floor: 0, widthM: 3.5, lengthM: 4.5 },
    { type: 'DINING_ROOM', floor: 0, widthM: 3, lengthM: 4 },
    { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4.5, label: 'Master' },
    { type: 'BEDROOM', floor: 1, widthM: 3.5, lengthM: 4 },
    { type: 'OFFICE', floor: 1, widthM: 3, lengthM: 3 },
    { type: 'BATHROOM', floor: 1, widthM: 2, lengthM: 2.5 },
  ],
  features: { garage: true, balcony: true },
};

/** Buffers the binary body instead of letting superagent guess at it. */
function pdfRequest(server: Server, url: string, cookies: string): request.Test {
  return request(server).get(url).set('Cookie', cookies).buffer(true);
}

function asBuffer(body: unknown): Buffer {
  if (!Buffer.isBuffer(body)) {
    throw new Error(`Expected a binary body, received ${typeof body}`);
  }
  return body;
}

describe('PDF export (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let ownerCookies: Cookies = {};
  let intruderCookies: Cookies = {};
  let projectId = '';
  let familyId = '';
  let draftId = '';

  const asOwner = (): string => cookieHeader(ownerCookies);
  const asIntruder = (): string => cookieHeader(intruderCookies);
  const pdfUrl = (id: string): string => `${API}/projects/${id}/export/pdf`;

  /** The e2e setup only migrates — prices come from the seed, so insert them here. */
  const activateRules = async (): Promise<void> => {
    await prisma.estimateRule.deleteMany();
    await prisma.estimateRule.create({
      data: { version: ESTIMATE_RULES_V1.version, data: ESTIMATE_RULES_V1, isActive: true },
    });
  };

  const createProject = async (name: string, config?: object): Promise<string> => {
    const created = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name })
      .expect(201);
    const id = String(created.body.id);
    if (config !== undefined) {
      await request(server)
        .patch(`${API}/projects/${id}`)
        .set('Cookie', asOwner())
        .send(config)
        .expect(200);
    }
    return id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);
    await activateRules();

    ownerCookies = (await registerUser(server, OWNER)).cookies;
    intruderCookies = (await registerUser(server, INTRUDER)).cookies;

    projectId = await createProject('Oilaviy uy — Qibray', VALID_CONFIG);
    familyId = await createProject('Katta oila uyi', FAMILY_CONFIG);
    draftId = await createProject('Qoralama');
  });

  // Exports are capped at 10/min/IP, and a suite that renders more than that
  // would fail on request count rather than on behaviour — so each test starts
  // from an empty bucket, and the cap gets a test of its own below.
  beforeEach(() => {
    const storage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    storage.storage.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    const res = await request(server).get(pdfUrl(projectId)).expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('hides another users project behind 404', async () => {
    const res = await request(server)
      .get(pdfUrl(projectId))
      .set('Cookie', asIntruder())
      .expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('rejects an unconfigured project with 409 PROJECT_NOT_CONFIGURED', async () => {
    const res = await request(server).get(pdfUrl(draftId)).set('Cookie', asOwner()).expect(409);
    expect(res.body).toMatchObject({ statusCode: 409, code: 'PROJECT_NOT_CONFIGURED' });
  });

  it('rejects an unknown locale with 400 VALIDATION_ERROR', async () => {
    const res = await request(server)
      .get(pdfUrl(projectId))
      .query({ locale: 'de' })
      .set('Cookie', asOwner())
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('exports a configured project as an attachment', async () => {
    const res = await pdfRequest(server, pdfUrl(projectId), asOwner()).expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');

    const disposition = String(res.headers['content-disposition']);
    expect(disposition).toContain('attachment;');
    // ASCII fallback for old agents, RFC 5987 name for everything else.
    expect(disposition).toContain('filename="archai-oilaviy-uy-qibray.pdf"');
    expect(disposition).toContain("filename*=UTF-8''archai-Oilaviy");

    const pdf = asBuffer(res.body);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.subarray(-6).toString('latin1').trim()).toBe('%%EOF');
    expect(Number(res.headers['content-length'])).toBe(pdf.length);

    // Cover + summary, floor plans, estimate — the plans page only exists
    // because the geometry rendered.
    expect(pdf.toString('latin1')).toContain('/Count 3');
    expect(pdf.length).toBeGreaterThan(15_000);
  });

  it('renders both floors and the full room table for an eight-room project', async () => {
    const res = await pdfRequest(server, pdfUrl(familyId), asOwner()).expect(200);

    const pdf = asBuffer(res.body);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // Summary, both floor plans on their own page, estimate.
    expect(pdf.toString('latin1')).toContain('/Count 4');
    expect(pdf.length).toBeGreaterThan(20_000);
  });

  it('exports byte-identical output for an unchanged project', async () => {
    const first = await pdfRequest(server, pdfUrl(projectId), asOwner()).expect(200);
    const second = await pdfRequest(server, pdfUrl(projectId), asOwner()).expect(200);

    // Metadata is pinned to project.updatedAt, so nothing in the file moves.
    expect(asBuffer(second.body).equals(asBuffer(first.body))).toBe(true);
  });

  it('changes when the project changes', async () => {
    const before = await pdfRequest(server, pdfUrl(projectId), asOwner()).expect(200);

    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send({ features: { pool: true } })
      .expect(200);

    const after = await pdfRequest(server, pdfUrl(projectId), asOwner()).expect(200);
    expect(asBuffer(after.body).equals(asBuffer(before.body))).toBe(false);
  });

  it('exports a different document per locale', async () => {
    const uz = await pdfRequest(server, pdfUrl(projectId), asOwner()).expect(200);
    const ru = await pdfRequest(server, `${pdfUrl(projectId)}?locale=ru`, asOwner()).expect(200);
    const en = await pdfRequest(server, `${pdfUrl(projectId)}?locale=en`, asOwner()).expect(200);

    const uzPdf = asBuffer(uz.body);
    const ruPdf = asBuffer(ru.body);
    const enPdf = asBuffer(en.body);
    expect(ruPdf.equals(uzPdf)).toBe(false);
    expect(enPdf.equals(uzPdf)).toBe(false);
    for (const pdf of [ruPdf, enPdf]) {
      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(15_000);
    }

    // Explicit uz is the default, so it must match the unparameterised export.
    const explicitUz = await pdfRequest(server, `${pdfUrl(projectId)}?locale=uz`, asOwner()).expect(
      200,
    );
    expect(asBuffer(explicitUz.body).equals(uzPdf)).toBe(true);
  });

  it('throttles exports to ten per minute per IP', async () => {
    for (let attempt = 0; attempt < PDF_EXPORT_RATE_LIMIT; attempt++) {
      await pdfRequest(server, pdfUrl(projectId), asOwner()).expect(200);
    }

    const res = await request(server).get(pdfUrl(projectId)).set('Cookie', asOwner()).expect(429);
    expect(res.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });
});
