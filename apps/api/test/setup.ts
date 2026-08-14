import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const API_DIR = resolve(__dirname, '..');
const MIGRATIONS_DIR = join(API_DIR, 'prisma', 'migrations');

/** Minimal .env reader — no dotenv dependency, existing env vars always win. */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  const content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key.length > 0 && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function hasMigrations(): boolean {
  if (!existsSync(MIGRATIONS_DIR)) {
    return false;
  }
  return readdirSync(MIGRATIONS_DIR).some((entry) =>
    statSync(join(MIGRATIONS_DIR, entry)).isDirectory(),
  );
}

loadEnvFile(join(API_DIR, '.env'));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || testDatabaseUrl.length === 0) {
  throw new Error(
    'TEST_DATABASE_URL is not set — refusing to run e2e tests against the development database.',
  );
}

// Everything downstream (Prisma CLI + PrismaClient) reads DATABASE_URL.
process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';

const globalState = globalThis as unknown as { __archaiSchemaReady__?: boolean };
if (globalState.__archaiSchemaReady__ !== true) {
  // `migrate deploy` is the real path; `db push` keeps e2e runnable before the
  // first migration has been generated into prisma/migrations.
  const command = hasMigrations()
    ? 'pnpm exec prisma migrate deploy'
    : 'pnpm exec prisma db push --skip-generate --accept-data-loss';
  execSync(command, { cwd: API_DIR, env: process.env, stdio: 'inherit' });
  globalState.__archaiSchemaReady__ = true;
}
