#!/usr/bin/env node
/**
 * Copies the AI provider keys from apps/api/.env into the deployed API project,
 * then redeploys so they take effect.
 *
 *   node scripts/vercel-ai-keys.mjs
 *
 * The keys are piped straight from the local .env into `vercel env add` — they
 * are never printed, never written anywhere else, and never leave your machine
 * except to your own Vercel project. Only the key *length* is reported, so you
 * can confirm the right value was picked up without exposing it.
 *
 * Everything else about the deployment is already configured; this exists
 * because the AI endpoints are the one part that stays dark without them. The
 * API is built to degrade honestly (503 + `AI_NOT_CONFIGURED`) rather than
 * break, so running this is optional.
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(repoRoot, 'apps', 'api');
const KEYS = ['GEMINI_API_KEY', 'GROQ_API_KEY'];

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function run(cmd, args, { cwd = repoRoot, input, quiet = true, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, ...env },
      stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
    });
    let out = '';
    const capture = (d) => {
      out += d;
      if (!quiet) process.stdout.write(d);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

const envFile = path.join(apiDir, '.env');
if (!existsSync(envFile)) {
  console.error(c.red(`✗ ${envFile} not found`));
  process.exit(1);
}
if (!existsSync(path.join(apiDir, '.vercel', 'project.json'))) {
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
  // Remove first: `add` fails on an existing key rather than replacing it.
  await run('vercel', ['env', 'rm', key, 'production', '--yes'], { cwd: apiDir, input: '' });
  const { code } = await run('vercel', ['env', 'add', key, 'production'], {
    cwd: apiDir,
    input: `${value}\n`,
  });
  if (code === 0) {
    console.log(`  ${c.green('ok')}   ${key} ${c.dim(`(${value.length} chars)`)}`);
    copied += 1;
  } else {
    console.log(`  ${c.red('FAIL')} ${key}`);
  }
}

if (copied === 0) {
  console.log('\nNothing to deploy.\n');
  process.exit(0);
}

// Vercel only picks up environment changes on a new deployment. Deploy from the
// repo root: the project's Root Directory is apps/api, but the upload has to
// include the workspace lockfile at the root.
console.log('\nRedeploying so the keys take effect — a few minutes.\n');
const { projectId, orgId } = JSON.parse(
  readFileSync(path.join(apiDir, '.vercel', 'project.json'), 'utf8'),
);
const { code } = await run('vercel', ['deploy', '--prod', '--yes'], {
  quiet: false,
  env: { VERCEL_PROJECT_ID: projectId, VERCEL_ORG_ID: orgId },
});

if (code !== 0) {
  console.error(c.red('\n✗ redeploy failed — the keys are stored, so just rerun the deploy\n'));
  process.exit(1);
}
console.log(c.green('\n✓ AI keys live.'), 'Check the AI Arxitektor tab, or:');
console.log(c.dim('  curl -s https://archai-api.vercel.app/api/v1/health\n'));
