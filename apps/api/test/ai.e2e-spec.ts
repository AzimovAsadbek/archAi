import {
  type ArchitectureAIProvider,
  type ParseProjectInput,
  type ParseProjectResult,
  PARSE_PROJECT_PROMPT_VERSION,
  type ProjectProposal,
} from '@archai/ai';
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ARCHITECTURE_AI_PROVIDER } from '../src/ai/ai.constants';
import { SERVER_NOTE_PREFIX } from '../src/ai/proposal.sanitizer';
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

const PARSE_URL = `${API}/ai/parse-project`;

const REQUEST_TEXT = '8 sotix yerda ikki qavatli uy, 3 ta yotoqxona va garaj kerak';

const USER = {
  email: 'ai-user@archai.uz',
  password: 'Passw0rd1',
  fullName: 'AI Requester',
};

/** Every column `ai_generations` is allowed to have — none of them holds text. */
const PROVENANCE_COLUMNS = [
  'createdAt',
  'durationMs',
  'errorCode',
  'id',
  'inputTokens',
  'kind',
  'model',
  'outputTokens',
  'promptVersion',
  'provider',
  'status',
  'userId',
];

const proposal = (overrides: Partial<ProjectProposal> = {}): ProjectProposal => ({
  name: 'Oilaviy uy',
  description: '8 sotixlik yerda ikki qavatli uy',
  land: { areaM2: 800, widthM: 20, lengthM: 40 },
  house: { widthM: 12, lengthM: 14, floorCount: 2, style: 'MODERN' },
  rooms: [
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4.5, label: null },
    { type: 'KITCHEN', floor: 0, widthM: null, lengthM: null, label: null },
    { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5, label: null },
  ],
  features: { garage: true, terrace: null, balcony: null, pool: false, garden: null },
  detectedLanguage: 'uz',
  assumptions: ['8 sotix 800 m² deb hisoblandi'],
  unmappable: ['Byudjet loyiha sxemasida saqlanmaydi'],
  ...overrides,
});

const success = (override?: Partial<ProjectProposal>): ParseProjectResult => ({
  ok: true,
  proposal: proposal(override),
  provenance: {
    provider: 'fake',
    model: 'claude-opus-5',
    promptVersion: PARSE_PROJECT_PROMPT_VERSION,
    inputTokens: 1_234,
    outputTokens: 567,
    durationMs: 4_210,
  },
});

/** Stands in for the Anthropic provider — bound through the DI token, no network. */
class FakeAiProvider implements ArchitectureAIProvider {
  readonly name = 'fake';
  result: ParseProjectResult = success();
  lastInput: ParseProjectInput | null = null;

  parseProjectRequest(input: ParseProjectInput): Promise<ParseProjectResult> {
    this.lastInput = input;
    return Promise.resolve(this.result);
  }
}

describe('AI parse-project — unconfigured (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let cookies: Cookies = {};
  let userId = '';

  const asUser = (): string => cookieHeader(cookies);

  beforeAll(async () => {
    // The dev/test default: no key configured. Pinned here so a developer's own
    // key in .env cannot turn this suite green for the wrong reason.
    process.env.ANTHROPIC_API_KEY = '';

    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);

    const registered = await registerUser(server, USER);
    cookies = registered.cookies;
    userId = registered.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    const res = await request(server).post(PARSE_URL).send({ text: REQUEST_TEXT }).expect(401);

    expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    expect(await prisma.aiGeneration.count()).toBe(0);
  });

  it('rejects a too-short request with 400 VALIDATION_ERROR', async () => {
    const res = await request(server)
      .post(PARSE_URL)
      .set('Cookie', asUser())
      .send({ text: 'uy' })
      .expect(400);

    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(res.body.details[0].message).toBe('ai_text_min');
    expect(await prisma.aiGeneration.count()).toBe(0);
  });

  it('rejects an over-long request and an unknown locale hint with 400', async () => {
    await request(server)
      .post(PARSE_URL)
      .set('Cookie', asUser())
      .send({ text: 'a'.repeat(2_001) })
      .expect(400);

    await request(server)
      .post(PARSE_URL)
      .set('Cookie', asUser())
      .send({ text: REQUEST_TEXT, localeHint: 'de' })
      .expect(400);
  });

  it('answers 503 AI_NOT_CONFIGURED and records the attempt', async () => {
    const res = await request(server)
      .post(PARSE_URL)
      .set('Cookie', asUser())
      .send({ text: REQUEST_TEXT })
      .expect(503);

    expect(res.body).toMatchObject({ statusCode: 503, code: 'AI_NOT_CONFIGURED' });
    expect(res.body.message).not.toBe('Internal server error');

    const rows = await prisma.aiGeneration.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      kind: 'PARSE_PROJECT',
      status: 'FAILED',
      errorCode: 'AI_NOT_CONFIGURED',
      provider: 'unconfigured',
    });
  });
});

describe('AI parse-project — fake provider (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let cookies: Cookies = {};
  let userId = '';
  const provider = new FakeAiProvider();

  const asUser = (): string => cookieHeader(cookies);
  const parse = (body: string | object): request.Test =>
    request(server).post(PARSE_URL).set('Cookie', asUser()).send(body);

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(ARCHITECTURE_AI_PROVIDER).useValue(provider),
    );
    prisma = app.get(PrismaService);
    server = httpServer(app);
    await resetDatabase(prisma);

    const registered = await registerUser(server, USER);
    cookies = registered.cookies;
    userId = registered.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    provider.result = success();
    provider.lastInput = null;
    await prisma.aiGeneration.deleteMany();
  });

  it('returns the proposal, domain validation and provenance', async () => {
    const res = await parse({ text: REQUEST_TEXT, localeHint: 'uz' }).expect(200);

    expect(res.body.proposal).toMatchObject({
      name: 'Oilaviy uy',
      land: { areaM2: 800, widthM: 20, lengthM: 40 },
      house: { widthM: 12, lengthM: 14, floorCount: 2, style: 'MODERN' },
      detectedLanguage: 'uz',
    });
    expect(res.body.proposal.rooms).toHaveLength(3);
    expect(res.body.proposal.assumptions).toEqual(['8 sotix 800 m² deb hisoblandi']);
    expect(res.body.proposal.unmappable).toEqual(['Byudjet loyiha sxemasida saqlanmaydi']);
    expect(res.body.validation).toMatchObject({ valid: true, errors: [] });
    expect(res.body.provenance).toEqual({
      provider: 'fake',
      model: 'claude-opus-5',
      promptVersion: PARSE_PROJECT_PROMPT_VERSION,
      inputTokens: 1_234,
      outputTokens: 567,
      durationMs: 4_210,
    });

    // The endpoint proposes only — nothing is persisted as a project.
    expect(await prisma.project.count()).toBe(0);

    // The request reaches the provider unchanged.
    expect(provider.lastInput).toEqual({ text: REQUEST_TEXT, localeHint: 'uz' });
  });

  it('writes a SUCCEEDED provenance row that holds no text', async () => {
    await parse({ text: REQUEST_TEXT }).expect(200);

    const rows = await prisma.aiGeneration.findMany();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toMatchObject({
      userId,
      kind: 'PARSE_PROJECT',
      status: 'SUCCEEDED',
      errorCode: null,
      provider: 'fake',
      model: 'claude-opus-5',
      promptVersion: PARSE_PROJECT_PROMPT_VERSION,
      inputTokens: 1_234,
      outputTokens: 567,
      durationMs: 4_210,
    });

    // Provenance may never grow a column that could hold the request or output.
    expect(Object.keys(row ?? {}).sort()).toEqual(PROVENANCE_COLUMNS);
    expect(JSON.stringify(row)).not.toContain('sotix');
  });

  it('drops schema-invalid blocks instead of failing, and says so', async () => {
    provider.result = success({
      land: { areaM2: 12, widthM: null, lengthM: null },
      rooms: [
        { type: 'KITCHEN', floor: 0, widthM: null, lengthM: null, label: null },
        { type: 'BEDROOM', floor: 0, widthM: 900, lengthM: 4, label: null },
      ],
    });

    const res = await parse({ text: REQUEST_TEXT }).expect(200);

    expect(res.body.proposal.land).toBeNull();
    expect(res.body.proposal.house).not.toBeNull();
    expect(res.body.proposal.rooms).toHaveLength(1);
    expect(res.body.proposal.rooms[0].type).toBe('KITCHEN');

    const serverNotes = (res.body.proposal.assumptions as string[]).filter((note) =>
      note.startsWith(SERVER_NOTE_PREFIX),
    );
    expect(serverNotes).toHaveLength(2);
    // The model's own assumptions are kept alongside the server's notes.
    expect(res.body.proposal.assumptions).toContain('8 sotix 800 m² deb hisoblandi');
    expect(await prisma.aiGeneration.count()).toBe(1);
  });

  it('reports domain-rule breaches in `validation` without failing the request', async () => {
    provider.result = success({
      land: { areaM2: 100, widthM: null, lengthM: null },
      house: { widthM: 40, lengthM: 40, floorCount: 1, style: null },
      rooms: [],
    });

    const res = await parse({ text: REQUEST_TEXT }).expect(200);

    expect(res.body.validation.valid).toBe(false);
    expect(res.body.validation.errors.map((issue: { code: string }) => issue.code)).toContain(
      'HOUSE_EXCEEDS_LAND',
    );
    expect(res.body.proposal.house).not.toBeNull();
  });

  it('maps a provider failure to 502 and records a FAILED row', async () => {
    provider.result = {
      ok: false,
      error: 'AI_PROVIDER_ERROR',
      message: 'Anthropic API error (status=529): overloaded',
      provenance: {
        provider: 'fake',
        model: 'claude-opus-5',
        promptVersion: PARSE_PROJECT_PROMPT_VERSION,
        durationMs: 812,
      },
    };

    const res = await parse({ text: REQUEST_TEXT }).expect(502);

    expect(res.body).toMatchObject({ statusCode: 502, code: 'AI_PROVIDER_ERROR' });
    // The upstream diagnostic stays server-side.
    expect(res.body.message).not.toContain('529');

    const rows = await prisma.aiGeneration.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      status: 'FAILED',
      errorCode: 'AI_PROVIDER_ERROR',
      durationMs: 812,
      inputTokens: null,
      outputTokens: null,
    });
  });

  it('maps an upstream rate limit to 429 with the AI code, not the generic one', async () => {
    provider.result = {
      ok: false,
      error: 'AI_RATE_LIMITED',
      message: 'Anthropic rate limit reached',
      provenance: {
        provider: 'fake',
        model: 'claude-opus-5',
        promptVersion: PARSE_PROJECT_PROMPT_VERSION,
        durationMs: 120,
      },
    };

    const res = await parse({ text: REQUEST_TEXT }).expect(429);

    expect(res.body).toMatchObject({ statusCode: 429, code: 'AI_RATE_LIMITED' });
    const rows = await prisma.aiGeneration.findMany();
    expect(rows[0]).toMatchObject({ status: 'FAILED', errorCode: 'AI_RATE_LIMITED' });
  });

  it('maps a refusal to 422', async () => {
    provider.result = {
      ok: false,
      error: 'AI_REFUSED',
      message: 'The model declined to answer this request',
      provenance: {
        provider: 'fake',
        model: 'claude-opus-5',
        promptVersion: PARSE_PROJECT_PROMPT_VERSION,
        durationMs: 900,
      },
    };

    const res = await parse({ text: REQUEST_TEXT }).expect(422);

    expect(res.body).toMatchObject({ statusCode: 422, code: 'AI_REFUSED' });
    const rows = await prisma.aiGeneration.findMany();
    expect(rows[0]).toMatchObject({ status: 'FAILED', errorCode: 'AI_REFUSED' });
  });
});
