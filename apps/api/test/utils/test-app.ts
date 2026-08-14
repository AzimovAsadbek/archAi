import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { type Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type PrismaService } from '../../src/prisma/prisma.service';

export const API = '/api/v1';

export type Cookies = Record<string, string>;

/** Swaps providers before the module compiles, e.g. to bind a fake AI provider. */
export type ModuleCustomizer = (builder: TestingModuleBuilder) => TestingModuleBuilder;

/** Boots Nest with exactly the same HTTP wiring as `main.ts`. */
export async function createTestApp(customize?: ModuleCustomizer): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  const moduleRef = await (customize ? customize(builder) : builder).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.estimateRule.deleteMany();
  await prisma.aiGeneration.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.floorPlan.deleteMany();
  await prisma.room.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export function setCookieStrings(res: request.Response): string[] {
  const raw: unknown = res.headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === 'string');
  }
  return typeof raw === 'string' ? [raw] : [];
}

/** Applies the response's Set-Cookie headers onto a cookie jar. */
export function applyCookies(res: request.Response, jar: Cookies = {}): Cookies {
  const next: Cookies = { ...jar };
  for (const entry of setCookieStrings(res)) {
    const [pair] = entry.split(';');
    if (pair === undefined) {
      continue;
    }
    const separator = pair.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (value.length === 0) {
      delete next[name];
    } else {
      next[name] = value;
    }
  }
  return next;
}

export function cookieHeader(jar: Cookies): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export interface TestUser {
  email: string;
  password: string;
  fullName: string;
}

export interface RegisteredUser {
  user: TestUser;
  cookies: Cookies;
  id: string;
}

/** Registers a user and returns its session cookies. */
export async function registerUser(server: Server, user: TestUser): Promise<RegisteredUser> {
  const res = await request(server).post(`${API}/auth/register`).send(user);
  if (res.status !== 201) {
    throw new Error(`Registration failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const body: unknown = res.body;
  const id =
    typeof body === 'object' && body !== null && 'user' in body
      ? String((body as { user: { id: string } }).user.id)
      : '';
  return { user, cookies: applyCookies(res), id };
}
