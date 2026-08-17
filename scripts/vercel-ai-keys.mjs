#!/usr/bin/env node
/**
 * Copies the AI provider keys from apps/api/.env into the deployed API project,
 * then redeploys so they take effect.
 *
 *   node scripts/vercel-ai-keys.mjs
 *
 * The keys are piped into `vercel env add` over stdin — never printed, never
 * passed as a command-line argument (which would expose them in the process
 * list), never written anywhere else. Only the key *length* is reported, which
 * is enough to confirm the right value was picked up.
 *
 * Optional by design: without the keys the AI endpoints answer 503
 * AI_NOT_CONFIGURED and the rest of the product is unaffected.
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(repoRoot, 'apps', 'api');
const KEYS = ['GEMINI_API_KEY', 'GROQ_API_KEY'];

/**
 * How to invoke the Vercel CLI without a shell.
 *
 * Two Windows constraints collide here. `vercel` on PATH is a `.cmd` shim, and
 * Node 22+ refuses to spawn `.cmd` without `shell: true` (spawn EINVAL — the
 * fix for CVE-2024-27980). Turning the shell on to satisfy that brings back
 * DEP0190, because arguments are then concatenated rather than escaped.
 *
 * Running the CLI's own JS entry point under this Node binary sidesteps both:
 * no shim, no shell, arguments passed as a real argv array. The shell path
 * stays as a fallback for an install layout we do not recognise.
 */
function resolveCli() {
  const candidates = [];
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'vercel', 'dist', 'index.js'));
  }
  if (process.env.HOME) {
    candidates.push(path.join(process.env.HOME, '.npm-global', 'lib', 'node_modules', 'vercel', 'dist', 'index.js'));
  }
  candidates.push('/usr/local/lib/node_modules/vercel/dist/index.js');
  candidates.push('/usr/lib/node_modules/vercel/dist/index.js');

  for (const entry of candidates) {
    if (existsSync(entry)) return { cmd: process.execPath, prefix: [entry], shell: false };
  }
  return { cmd: process.platform === 'win32' ? 'vercel.cmd' : 'vercel', prefix: [], shell: true };
}

const cli = resolveCli();

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * Runs a command with a hard deadline.
 *
 * The deadline is the point of this wrapper: the previous version called
 * `vercel env rm` with no timeout, and when that command sat waiting the whole
 * script hung after printing its header with no indication of what it was
 * stuck on.
 */
function run(args, { cwd = repoRoot, input, quiet = true, env, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cli.cmd, [...cli.prefix, ...args], {
      cwd,
      env: { ...process.env, ...env },
      shell: cli.shell,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let out = '';
    let done = false;
    const finish = (code, note) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, out, note });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(1, `timed out after ${Math.round(timeoutMs / 1000)}s`);
    }, timeoutMs);

    const capture = (d) => {
      out += d;
      if (!quiet) process.stdout.write(d);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (err) => finish(1, err.message));
    child.on('close', (code) => finish(code ?? 1));

    // Always close stdin, even with nothing to send: a CLI that decides to
    // prompt then reads EOF and gives up instead of waiting forever.
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

const envFile = path.join(apiDir, '.env');
const projectFile = path.join(apiDir, '.vercel', 'project.json');

if (!existsSync(envFile)) {
  console.error(c.red(`✗ ${envFile} not found`));
  process.exit(1);
}
if (!existsSync(projectFile)) {
  console.error(c.red('✗ apps/api is not linked to a Vercel project — run `vercel link` there'));
  process.exit(1);
}

const local = {};
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) local[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

console.log('\nCopying AI keys from apps/api/.env → archai-api (production)\n');

let copied = 0;
for (const key of KEYS) {
  const value = local[key];
  if (!value) {
    console.log(`  ${c.dim('skip')} ${key} ${c.dim('(empty in .env)')}`);
    continue;
  }

  process.stdout.write(`  ...  ${key} `);
  // `--force` replaces an existing value in one call. The previous version did
  // `env rm` then `env add`, and the removal is what hung.
  // `--sensitive` keeps the value unreadable in the dashboard afterwards.
  const { code, out, note } = await run(
    ['env', 'add', key, 'production', '--force', '--sensitive'],
    { cwd: apiDir, input: `${value}\n`, timeoutMs: 120_000 },
  );

  if (code === 0) {
    console.log(`\r  ${c.green('ok')}   ${key} ${c.dim(`(${value.length} chars)`)}     `);
    copied += 1;
  } else {
    const reason = note ?? out.split('\n').filter(Boolean).pop() ?? 'unknown error';
    console.log(`\r  ${c.red('FAIL')} ${key} ${c.dim(`— ${reason.slice(0, 90)}`)}`);
  }
}

if (copied === 0) {
  console.log('\nNothing copied — nothing to deploy.\n');
  process.exit(1);
}

// Vercel only picks up environment changes on a new deployment. Deploy from the
// repo root: the project's Root Directory is apps/api, but the upload has to
// include the workspace lockfile at the root.
console.log(`\n${copied} key(s) stored. Redeploying — this takes a few minutes.\n`);
const { projectId, orgId } = JSON.parse(readFileSync(projectFile, 'utf8'));
const { code } = await run(['deploy', '--prod', '--yes'], {
  quiet: false,
  timeoutMs: 900_000,
  env: { VERCEL_PROJECT_ID: projectId, VERCEL_ORG_ID: orgId },
});

if (code !== 0) {
  console.error(c.red('\n✗ redeploy failed — the keys are stored, so just rerun the deploy\n'));
  process.exit(1);
}
console.log(c.green('\n✓ AI keys live.'), 'Verify with the AI Arxitektor tab in the workspace.\n');
