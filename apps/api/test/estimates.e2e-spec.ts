import { type INestApplication } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ESTIMATE_RULES_V1 } from '../prisma/estimate-rules.v1';
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
  email: 'smeta-owner@archai.uz',
  password: 'Passw0rd1',
  fullName: 'Smeta Owner',
};
const INTRUDER = {
  email: 'smeta-intruder@archai.uz',
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

/**
 * Hand-computed from `ESTIMATE_RULES_V1` and `VALID_CONFIG` (see the unit tests in
 * `@archai/shared` for the full arithmetic):
 *   structure = 143 m² × 3_500_000 × (1 + 1.08)     = 1_041_040_000
 *   features  = 60_000_000 + 25_000_000 + 48_000_000 =   133_000_000
 *   finish    = 286 m² × the tier price
 *   total     = structure + finish + features + 10% contingency
 */
const EXPECTED = {
  structure: 1_041_040_000,
  features: 133_000_000,
  STANDARD: { finish: 572_000_000, contingency: 174_604_000, total: 1_920_644_000 },
  COMFORT: { finish: 915_200_000, contingency: 208_924_000, total: 2_298_164_000 },
  PREMIUM: { finish: 1_430_000_000, contingency: 260_404_000, total: 2_864_444_000 },
} as const;

interface LineShape {
  key: string;
  amount: number;
  meta?: Record<string, string | number>;
}

interface EstimateShape {
  lines: LineShape[];
  featureLines: LineShape[];
  total: number;
  rangeMin: number;
  rangeMax: number;
  costPerM2: number;
  grossFloorAreaM2: number;
  finishLevel: string;
  rulesVersion: string;
  currency: string;
}

function amountOf(estimate: EstimateShape, key: string): number {
  return estimate.lines.find((line) => line.key === key)?.amount ?? Number.NaN;
}

describe('Estimate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let ownerCookies: Cookies = {};
  let intruderCookies: Cookies = {};
  let projectId = '';
  let draftId = '';

  const asOwner = (): string => cookieHeader(ownerCookies);
  const asIntruder = (): string => cookieHeader(intruderCookies);
  const estimateUrl = (id: string): string => `${API}/projects/${id}/estimate`;

  /** The e2e setup only migrates — prices come from the seed, so insert them here. */
  const activateRules = async (): Promise<void> => {
    await prisma.estimateRule.deleteMany();
    await prisma.estimateRule.create({
      data: { version: ESTIMATE_RULES_V1.version, data: ESTIMATE_RULES_V1, isActive: true },
    });
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);
    await activateRules();

    ownerCookies = (await registerUser(server, OWNER)).cookies;
    intruderCookies = (await registerUser(server, INTRUDER)).cookies;

    const created = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name: 'Oilaviy uy — Qibray' })
      .expect(201);
    projectId = String(created.body.id);

    await request(server)
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', asOwner())
      .send(VALID_CONFIG)
      .expect(200);

    const draft = await request(server)
      .post(`${API}/projects`)
      .set('Cookie', asOwner())
      .send({ name: 'Qoralama' })
      .expect(201);
    draftId = String(draft.body.id);
  });

  // Pricing is capped at 30/min/IP, and the throttle test below fires more than
  // that in a tight loop — so each test starts from an empty bucket, as PDF does.
  beforeEach(() => {
    const storage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    storage.storage.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    const res = await request(server).get(estimateUrl(projectId)).expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('hides another users project behind 404', async () => {
    const res = await request(server)
      .get(estimateUrl(projectId))
      .set('Cookie', asIntruder())
      .expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('rejects an unconfigured project with 409 PROJECT_NOT_CONFIGURED', async () => {
    const res = await request(server)
      .get(estimateUrl(draftId))
      .set('Cookie', asOwner())
      .expect(409);
    expect(res.body).toMatchObject({ statusCode: 409, code: 'PROJECT_NOT_CONFIGURED' });
  });

  it('prices a configured project with the seeded rules', async () => {
    const res = await request(server)
      .get(estimateUrl(projectId))
      .set('Cookie', asOwner())
      .expect(200);

    const estimate = res.body.estimate as EstimateShape;
    expect(estimate.finishLevel).toBe('STANDARD'); // default, no query given
    expect(estimate.rulesVersion).toBe(ESTIMATE_RULES_V1.version);
    expect(estimate.currency).toBe('UZS');
    expect(estimate.grossFloorAreaM2).toBe(286);

    expect(amountOf(estimate, 'structure')).toBe(EXPECTED.structure);
    expect(amountOf(estimate, 'finish')).toBe(EXPECTED.STANDARD.finish);
    expect(amountOf(estimate, 'features')).toBe(EXPECTED.features);
    expect(amountOf(estimate, 'labor-info')).toBe(564_564_000); // 1_613_040_000 × 0.35
    expect(amountOf(estimate, 'contingency')).toBe(EXPECTED.STANDARD.contingency);
    expect(estimate.total).toBe(EXPECTED.STANDARD.total);

    // 1_920_644_000 × 0.85 / × 1.15, then rounded to 1000 UZS.
    expect(estimate.rangeMin).toBe(1_632_547_000);
    expect(estimate.rangeMax).toBe(2_208_741_000);
    // 1_920_644_000 / 286 m² = 6_715_538.46 → 6_716_000
    expect(estimate.costPerM2).toBe(6_716_000);

    // Only the enabled features are priced, and they add up to the features line.
    expect(estimate.featureLines.map((line) => line.key)).toEqual(['garage', 'terrace', 'garden']);
    const featureSum = estimate.featureLines.reduce((sum, line) => sum + line.amount, 0);
    expect(featureSum).toBe(EXPECTED.features);
    // The breakdown the user sees always adds up to the total.
    expect(
      amountOf(estimate, 'structure') +
        amountOf(estimate, 'finish') +
        amountOf(estimate, 'features') +
        amountOf(estimate, 'contingency'),
    ).toBe(estimate.total);
  });

  it('reprices when the finish level changes', async () => {
    const comfort = await request(server)
      .get(estimateUrl(projectId))
      .query({ finishLevel: 'COMFORT' })
      .set('Cookie', asOwner())
      .expect(200);

    const comfortEstimate = comfort.body.estimate as EstimateShape;
    expect(comfortEstimate.finishLevel).toBe('COMFORT');
    expect(amountOf(comfortEstimate, 'finish')).toBe(EXPECTED.COMFORT.finish);
    expect(comfortEstimate.total).toBe(EXPECTED.COMFORT.total);

    const premium = await request(server)
      .get(estimateUrl(projectId))
      .query({ finishLevel: 'PREMIUM' })
      .set('Cookie', asOwner())
      .expect(200);

    const premiumEstimate = premium.body.estimate as EstimateShape;
    expect(premiumEstimate.finishLevel).toBe('PREMIUM');
    expect(amountOf(premiumEstimate, 'finish')).toBe(EXPECTED.PREMIUM.finish);
    expect(premiumEstimate.total).toBe(EXPECTED.PREMIUM.total);

    // The finish tier is the only thing that moved.
    expect(amountOf(premiumEstimate, 'structure')).toBe(EXPECTED.structure);
    expect(amountOf(premiumEstimate, 'features')).toBe(EXPECTED.features);
    expect(premiumEstimate.total).toBeGreaterThan(comfortEstimate.total);
  });

  it('rejects an unknown finish level with 400 VALIDATION_ERROR', async () => {
    const res = await request(server)
      .get(estimateUrl(projectId))
      .query({ finishLevel: 'LUXURY' })
      .set('Cookie', asOwner())
      .expect(400);

    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('never estimates without active rules, and leaks nothing about why', async () => {
    await prisma.estimateRule.deleteMany();
    try {
      const res = await request(server)
        .get(estimateUrl(projectId))
        .set('Cookie', asOwner())
        .expect(500);

      // ESTIMATE_RULES_MISSING is a server-side classification only.
      expect(res.body).toEqual({
        statusCode: 500,
        code: 'INTERNAL',
        message: 'Internal server error',
      });
      expect(JSON.stringify(res.body)).not.toContain('ESTIMATE_RULES_MISSING');
    } finally {
      await activateRules();
    }
  });

  it('never estimates from rules that no longer match the schema', async () => {
    await prisma.estimateRule.deleteMany();
    await prisma.estimateRule.create({
      // A price was blanked out by hand — partial results are not an option.
      data: {
        version: '1',
        data: { ...ESTIMATE_RULES_V1, structureCostPerM2: 'free' },
        isActive: true,
      },
    });
    try {
      const res = await request(server)
        .get(estimateUrl(projectId))
        .set('Cookie', asOwner())
        .expect(500);

      expect(res.body).toMatchObject({ statusCode: 500, code: 'INTERNAL' });
    } finally {
      await activateRules();
    }
  });

  it('prices again once the rules are back', async () => {
    const res = await request(server)
      .get(estimateUrl(projectId))
      .set('Cookie', asOwner())
      .expect(200);

    expect((res.body.estimate as EstimateShape).total).toBe(EXPECTED.STANDARD.total);
  });

  it('returns 404 for a project id containing a NUL byte', async () => {
    // A control byte in the id can crash the Prisma driver; IdParamPipe turns it
    // into an ordinary "not found" before the request reaches the service.
    const res = await request(server)
      .get(`${API}/projects/%00/estimate`)
      .set('Cookie', asOwner())
      .expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('throttles estimates to thirty per minute per IP', async () => {
    for (let attempt = 0; attempt < GENERATE_RATE_LIMIT; attempt++) {
      await request(server).get(estimateUrl(projectId)).set('Cookie', asOwner()).expect(200);
    }

    const res = await request(server)
      .get(estimateUrl(projectId))
      .set('Cookie', asOwner())
      .expect(429);
    expect(res.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });
});
