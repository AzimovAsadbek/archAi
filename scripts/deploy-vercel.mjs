#!/usr/bin/env node
/**
 * One-command Vercel + Neon deployment for archAi.
 *
 * Run from the repo root:  node scripts/deploy-vercel.mjs
 *
 * Why this exists rather than a list of dashboard steps: the deployment needs
 * ~15 environment variables spread over two projects, several of which must NOT
 * be copied from `apps/api/.env` — the local values are actively wrong for
 * production (see PRODUCTION_OVERRIDES below). Doing it by hand is how a
 * `COOKIE_SECURE=false` or a development JWT secret ends up in production.
 *
 * Secrets never leave your machine through anything but the Vercel CLI:
 *   - the Neon URLs are typed into this script and piped straight to `vercel env add`
 *   - the JWT secrets are generated here, fresh, and never printed
 *   - only the AI keys are read from apps/api/.env, and their values are never echoed
 *
 * The script is idempotent: re-running it replaces the environment variables
 * and redeploys. It never touches your local database or .env.
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(repoRoot, 'apps', 'api');
const webDir = path.join(repoRoot, 'apps', 'web');

const API_PROJECT = process.env.ARCHAI_API_PROJECT ?? 'archai-api';
const WEB_PROJECT = process.env.ARCHAI_WEB_PROJECT ?? 'archai-web';

// ── tiny console helpers ──────────────────────────────────────────────────
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};
const step = (n, total, msg) => console.log(`\n${c.bold(`[${n}/${total}]`)} ${msg}`);
const ok = (msg) => console.log(`  ${c.green('✓')} ${msg}`);
const warn = (msg) => console.log(`  ${c.yellow('!')} ${msg}`);
const die = (msg) => {
  console.error(`\n${c.red('✗')} ${msg}\n`);
  process.exit(1);
};

/** Runs a command, returning {code, stdout}. `input` is written to stdin. */
function run(cmd, args, { cwd = repoRoot, input, quiet = true, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true, // `vercel` is a .cmd shim on Windows
      env: { ...process.env, ...env },
      stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      if (!quiet) process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      out += d;
      if (!quiet) process.stderr.write(d);
    });
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

/** Prompt. `mask: true` keeps the value off the screen and out of scrollback. */
function ask(question, { mask = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (mask) {
      // Suppress echo: readline still receives the keystrokes, the terminal
      // just never renders them.
      const onData = (char) => {
        if (['\n', '\r', ''].includes(char.toString())) process.stdin.removeListener('data', onData);
        else process.stdout.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length));
      };
      process.stdin.on('data', onData);
    }
    rl.question(question, (answer) => {
      rl.close();
      if (mask) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

/** Reads apps/api/.env into a map. Values are used, never logged. */
function readLocalEnv() {
  const file = path.join(apiDir, '.env');
  if (!existsSync(file)) return {};
  const map = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    map[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return map;
}

/**
 * Values that must NOT be inherited from the development environment.
 *
 * Each one is a real failure mode, not a preference:
 *  - NODE_ENV       — anything but `production` leaves Swagger served publicly
 *  - COOKIE_SECURE  — the API refuses to boot in production without it, and
 *                     `false` would put session cookies on plain HTTP
 *  - TRUST_PROXY_HOPS — Vercel's proxy is exactly one hop. At 0 the rate
 *                     limiter keys every request to the proxy address, so all
 *                     users share a single bucket and the limit is meaningless
 */
const PRODUCTION_OVERRIDES = {
  NODE_ENV: 'production',
  COOKIE_SECURE: 'true',
  TRUST_PROXY_HOPS: '1',
};

/** Sets one production env var on a project, replacing any existing value. */
async function setEnv(cwd, name, value) {
  // `rm` first: `add` on an existing key fails rather than replacing.
  await run('vercel', ['env', 'rm', name, 'production', '--yes'], { cwd, input: '' });
  const { code, out } = await run('vercel', ['env', 'add', name, 'production'], {
    cwd,
    input: `${value}\n`,
  });
  if (code !== 0) die(`could not set ${name}\n${out}`);
}

async function deploy(cwd, label) {
  console.log(`  ${c.dim(`building and deploying ${label} — this takes a few minutes`)}`);
  const { code, out } = await run('vercel', ['deploy', '--prod', '--yes'], { cwd, quiet: false });
  if (code !== 0) die(`${label} deployment failed`);
  const url = [...out.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/gi)].pop()?.[0];
  if (!url) die(`${label} deployed but no URL was found in the output`);
  return url;
}

async function main() {
  const TOTAL = 9;
  console.log(c.bold('\narchAi → Vercel + Neon\n'));

  // ── 1. preflight ────────────────────────────────────────────────────────
  step(1, TOTAL, 'Checking prerequisites');
  const who = await run('vercel', ['whoami']);
  if (who.code !== 0) die('not logged in to Vercel — run `vercel login` first');
  ok(`Vercel account: ${who.out.trim().split('\n').pop()}`);

  const local = readLocalEnv();
  const geminiKey = local.GEMINI_API_KEY ?? '';
  const groqKey = local.GROQ_API_KEY ?? '';
  if (!geminiKey && !groqKey) warn('no AI keys found in apps/api/.env — AI endpoints will answer 503');
  else ok('AI keys found locally (values are never printed)');

  // ── 2. Neon ─────────────────────────────────────────────────────────────
  step(2, TOTAL, 'Neon connection strings');
  console.log(
    c.dim(
      '  Create a project at https://console.neon.tech, then copy both strings.\n' +
        '  Pooled  = host contains "-pooler"  → used by the running API\n' +
        '  Direct  = host without "-pooler"   → used by migrations only\n',
    ),
  );
  const pooled = await ask('  Pooled DATABASE_URL: ', { mask: true });
  if (!/^postgres/.test(pooled)) die('that does not look like a postgres URL');
  if (!pooled.includes('-pooler')) warn('the pooled URL usually contains "-pooler" — double-check it');
  const direct = await ask('  Direct DIRECT_DATABASE_URL: ', { mask: true });
  if (!/^postgres/.test(direct)) die('that does not look like a postgres URL');
  ok('connection strings captured');

  // ── 3. migrate ──────────────────────────────────────────────────────────
  step(3, TOTAL, 'Applying migrations to Neon');
  const migrate = await run('pnpm', ['--filter', '@archai/api', 'prisma:deploy'], {
    env: { DATABASE_URL: pooled, DIRECT_DATABASE_URL: direct },
  });
  if (migrate.code !== 0) die(`migration failed\n${migrate.out}`);
  ok('schema applied');

  // ── 4. secrets ──────────────────────────────────────────────────────────
  step(4, TOTAL, 'Generating production JWT secrets');
  // Fresh, not copied from .env: development secrets are shared with everyone
  // who has ever had a copy of the repo's environment, and a leaked signing key
  // means forged sessions.
  const accessSecret = randomBytes(48).toString('base64url');
  const refreshSecret = randomBytes(48).toString('base64url');
  ok('two independent 64-char secrets generated (never printed, never stored locally)');

  // ── 5. API project ──────────────────────────────────────────────────────
  step(5, TOTAL, `Linking the API project (${API_PROJECT})`);
  const linkApi = await run('vercel', ['link', '--yes', '--project', API_PROJECT], { cwd: apiDir });
  if (linkApi.code !== 0) die(`could not link ${API_PROJECT}\n${linkApi.out}`);
  ok('linked');

  step(6, TOTAL, 'Setting API environment');
  const apiEnv = {
    ...PRODUCTION_OVERRIDES,
    DATABASE_URL: pooled,
    DIRECT_DATABASE_URL: direct,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_TTL_SEC: local.JWT_ACCESS_TTL_SEC ?? '900',
    JWT_REFRESH_TTL_SEC: local.JWT_REFRESH_TTL_SEC ?? '2592000',
    AI_PROVIDER: local.AI_PROVIDER ?? 'gemini',
    AI_FALLBACK_PROVIDER: local.AI_FALLBACK_PROVIDER ?? 'groq',
    GEMINI_API_KEY: geminiKey,
    GROQ_API_KEY: groqKey,
    AI_PRIMARY_MODEL: local.AI_PRIMARY_MODEL ?? 'gemini-flash-latest',
    AI_FALLBACK_MODEL: local.AI_FALLBACK_MODEL ?? 'openai/gpt-oss-120b',
    AI_MAX_REQUESTS_PER_USER_PER_DAY: local.AI_MAX_REQUESTS_PER_USER_PER_DAY ?? '20',
    AI_TIMEOUT_MS: local.AI_TIMEOUT_MS ?? '30000',
    AI_MAX_RETRIES: local.AI_MAX_RETRIES ?? '1',
    // Replaced once the web URL is known; never left pointing at localhost.
    WEB_ORIGIN: 'https://placeholder.invalid',
  };
  for (const [k, v] of Object.entries(apiEnv)) {
    if (v === '') continue; // empty AI key is legitimate — the API degrades to 503
    await setEnv(apiDir, k, v);
  }
  ok(`${Object.keys(apiEnv).filter((k) => apiEnv[k] !== '').length} variables set`);

  step(7, TOTAL, 'Deploying the API');
  const apiUrl = await deploy(apiDir, 'API');
  ok(apiUrl);

  // ── 8. web project ──────────────────────────────────────────────────────
  step(8, TOTAL, `Linking and deploying the web app (${WEB_PROJECT})`);
  const linkWeb = await run('vercel', ['link', '--yes', '--project', WEB_PROJECT], { cwd: webDir });
  if (linkWeb.code !== 0) die(`could not link ${WEB_PROJECT}\n${linkWeb.out}`);
  await setEnv(webDir, 'NEXT_PUBLIC_API_URL', 'same-origin');
  await setEnv(webDir, 'API_ORIGIN', apiUrl);
  const webUrl = await deploy(webDir, 'web');
  ok(webUrl);

  // ── 9. close the loop ───────────────────────────────────────────────────
  step(9, TOTAL, 'Pointing the API back at the web origin');
  // Until now WEB_ORIGIN was a placeholder: the web URL only exists after its
  // first deploy, and the API had to exist before the web could proxy to it.
  await setEnv(apiDir, 'WEB_ORIGIN', webUrl);
  await deploy(apiDir, 'API (re-deploy with final CORS origin)');
  ok('CORS origin set');

  console.log(`\n${c.green(c.bold('Deployed.'))}`);
  console.log(`  web  ${c.bold(webUrl)}`);
  console.log(`  api  ${apiUrl}${c.dim('  (public, but every route is behind auth)')}`);
  console.log(
    c.dim(
      '\n  The database is empty — no accounts exist yet. Register through the UI.\n' +
        '  Do NOT run the seed against production: it plants repo-published demo passwords.\n',
    ),
  );
}

main().catch((err) => die(err?.stack ?? String(err)));
