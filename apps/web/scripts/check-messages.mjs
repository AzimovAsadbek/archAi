#!/usr/bin/env node
/**
 * i18n coverage check for apps/web.
 *
 * 1. Every locale file must expose exactly the same set of leaf keys.
 * 2. Every static `t('…')` call in src/ must resolve in all locale files.
 *
 * Run from anywhere: `node apps/web/scripts/check-messages.mjs`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, '..');
const messagesDir = join(webRoot, 'messages');
const srcDir = join(webRoot, 'src');

const LOCALES = ['uz', 'ru', 'en'];

// ── Load locale files ──────────────────────────────────────────────────────

function flatten(value, prefix = '', out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, path, out);
    } else {
      out.set(path, child);
    }
  }
  return out;
}

const catalogs = new Map();
for (const locale of LOCALES) {
  const file = join(messagesDir, `${locale}.json`);
  catalogs.set(locale, flatten(JSON.parse(readFileSync(file, 'utf8'))));
}

const problems = [];

// ── 1. Key parity across locales ───────────────────────────────────────────

const reference = LOCALES[0];
const referenceKeys = new Set(catalogs.get(reference).keys());

for (const locale of LOCALES.slice(1)) {
  const keys = new Set(catalogs.get(locale).keys());
  for (const key of referenceKeys) {
    if (!keys.has(key)) problems.push(`[parity] ${locale}.json is missing "${key}"`);
  }
  for (const key of keys) {
    if (!referenceKeys.has(key)) problems.push(`[parity] ${reference}.json is missing "${key}"`);
  }
}

// ── 2. Static t() usage in src/ ────────────────────────────────────────────

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

// `const t = useTranslations('ns')` / `const t = await getTranslations('ns')`
const TRANSLATOR_DECL = /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/g;

let usageCount = 0;

for (const file of walk(srcDir)) {
  const source = readFileSync(file, 'utf8');
  const namespaces = new Map();

  for (const match of source.matchAll(TRANSLATOR_DECL)) {
    const name = match[1];
    const namespace = match[2] ?? match[3] ?? '';
    if (namespaces.has(name) && namespaces.get(name) !== namespace) {
      // Same identifier bound to two namespaces in one file: key resolution
      // becomes ambiguous for this checker, so require distinct names.
      problems.push(
        `[ambiguous] ${relative(webRoot, file)} binds "${name}" to both ` +
          `"${namespaces.get(name)}" and "${namespace}" — rename one`,
      );
    }
    namespaces.set(name, namespace);
  }
  if (namespaces.size === 0) continue;

  const names = [...namespaces.keys()].sort((a, b) => b.length - a.length);
  const callPattern = new RegExp(
    `\\b(${names.map((n) => n.replace(/\$/g, '\\$')).join('|')})(?:\\.has)?\\(\\s*(['\`])([^'\`$]*)\\2`,
    'g',
  );

  for (const match of source.matchAll(callPattern)) {
    const namespace = namespaces.get(match[1]);
    const key = match[3];
    // Template literals with interpolation are filtered out by the `$` exclusion.
    if (key === '') continue;
    const fullKey = namespace === '' ? key : `${namespace}.${key}`;
    usageCount += 1;

    for (const locale of LOCALES) {
      if (!catalogs.get(locale).has(fullKey)) {
        problems.push(
          `[usage] ${relative(webRoot, file)} → "${fullKey}" missing in ${locale}.json`,
        );
      }
    }
  }
}

// ── 3. Enumerable dynamic keys (template literals the regex cannot resolve) ─

const ROOM_TYPES = [
  'BEDROOM',
  'LIVING_ROOM',
  'KITCHEN',
  'BATHROOM',
  'DINING_ROOM',
  'OFFICE',
  'STORAGE',
  'LAUNDRY',
  'HALLWAY',
  'OTHER',
];
const HOUSE_STYLES = [
  'MODERN',
  'MINIMALIST',
  'CLASSIC',
  'TRADITIONAL',
  'EUROPEAN',
  'NATIONAL',
];
const FEATURES = ['garage', 'terrace', 'balcony', 'pool', 'garden'];
const STATUSES = ['DRAFT', 'CONFIGURED', 'GENERATING', 'READY', 'ARCHIVED', 'FAILED'];
const DOMAIN_CODES = [
  'HOUSE_EXCEEDS_LAND',
  'HOUSE_WIDTH_EXCEEDS_LAND',
  'HOUSE_LENGTH_EXCEEDS_LAND',
  'HIGH_LAND_COVERAGE',
  'LAND_DIMENSIONS_MISMATCH',
  'ROOM_ON_MISSING_FLOOR',
  'FLOOR_AREA_EXCEEDED',
  'FLOOR_NEARLY_FULL',
  'MISSING_KITCHEN',
  'MISSING_BATHROOM',
  'NO_ROOMS',
  'unknown',
];
const FIELD_ERROR_KEYS = [
  'invalid',
  'required',
  'number_required',
  'invalid_email',
  'password_min',
  'password_max',
  'password_weak',
  'full_name_min',
  'full_name_max',
  'name_min',
  'name_max',
  'description_max',
  'land_area_min',
  'land_area_max',
  'land_side_min',
  'land_side_max',
  'house_side_min',
  'house_side_max',
  'floors_min',
  'floors_max',
  'room_side_min',
  'room_side_max',
  'too_many_rooms',
];
const API_ERROR_CODES = [
  'generic',
  'NETWORK_ERROR',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'VALIDATION_ERROR',
  'DOMAIN_VALIDATION_ERROR',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL',
  'PROJECT_ARCHIVED',
];

const dynamicKeys = [
  ...ROOM_TYPES.map((v) => `roomTypes.${v}`),
  ...HOUSE_STYLES.flatMap((v) => [`styles.${v}.label`, `styles.${v}.description`]),
  ...FEATURES.flatMap((v) => [`features.${v}.label`, `features.${v}.description`]),
  ...STATUSES.map((v) => `project.status.${v}`),
  ...DOMAIN_CODES.map((v) => `validation.codes.${v}`),
  ...FIELD_ERROR_KEYS.map((v) => `fieldErrors.${v}`),
  ...API_ERROR_CODES.map((v) => `apiErrors.${v}`),
  ...['describe', 'validate', 'visualize', 'export'].flatMap((v) => [
    `marketing.how.steps.${v}.title`,
    `marketing.how.steps.${v}.body`,
  ]),
  ...['configurator', 'ai', 'plans', 'preview', 'estimate', 'pdf'].flatMap((v) => [
    `marketing.features.items.${v}.title`,
    `marketing.features.items.${v}.body`,
  ]),
  ...['structure', 'errors', 'language'].flatMap((v) => [
    `marketing.value.items.${v}.title`,
    `marketing.value.items.${v}.body`,
  ]),
  ...['land', 'house', 'rooms', 'features', 'style', 'review'].map((v) => `wizard.steps.${v}`),
  ...['overview', 'plans2d', 'view3d', 'interior', 'exterior', 'estimate'].map(
    (v) => `workspace.tabs.${v}`,
  ),
  ...['uz', 'ru', 'en'].flatMap((v) => [`locale.${v}`, `locale.${v}Full`]),
];

for (const key of dynamicKeys) {
  for (const locale of LOCALES) {
    if (!catalogs.get(locale).has(key)) {
      problems.push(`[dynamic] "${key}" missing in ${locale}.json`);
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error(`i18n check FAILED (${problems.length} problem(s)):\n`);
  for (const problem of [...new Set(problems)].sort()) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `i18n check OK — ${referenceKeys.size} keys × ${LOCALES.length} locales, ` +
    `${usageCount} static t() usages + ${dynamicKeys.length} enumerated dynamic keys verified.`,
);
