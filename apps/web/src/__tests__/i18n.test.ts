import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import ru from '../../messages/ru.json';
import uz from '../../messages/uz.json';

type Json = Record<string, unknown>;
const CATALOGS: Record<string, Json> = { en, ru, uz };
const SRC = fileURLToPath(new URL('..', import.meta.url)); // apps/web/src

const leaves = (obj: Json, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v as Json, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const getKey = (obj: Json, dotted: string): unknown =>
  dotted.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Json)[k] : undefined), obj);

describe('message catalogs', () => {
  it('have identical key sets across uz / ru / en', () => {
    const enKeys = new Set(leaves(en));
    for (const [loc, cat] of Object.entries(CATALOGS)) {
      if (loc === 'en') continue;
      const locKeys = new Set(leaves(cat));
      expect({ loc, extra: [...locKeys].filter((k) => !enKeys.has(k)) }).toEqual({ loc, extra: [] });
      expect({ loc, missing: [...enKeys].filter((k) => !locKeys.has(k)) }).toEqual({ loc, missing: [] });
    }
  });

  it('have no empty or whitespace-only values', () => {
    for (const [loc, cat] of Object.entries(CATALOGS)) {
      const empties = leaves(cat).filter((k) => {
        const v = getKey(cat, k);
        return typeof v === 'string' && v.trim() === '';
      });
      expect({ loc, empties }).toEqual({ loc, empties: [] });
    }
  });
});

/** Every literal `t('key')` referenced in source must resolve in the catalog. */
describe('referenced translation keys', () => {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  })(SRC);

  it('all resolve in en.json (guards against dangling keys)', () => {
    const missing: string[] = [];
    const nsRe =
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/g;

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const ns: Record<string, string> = {};
      for (const m of src.matchAll(nsRe)) {
        const name = m[1];
        if (name !== undefined) ns[name] = m[2] ?? m[3] ?? m[4] ?? '';
      }
      const vars = Object.keys(ns);
      if (vars.length === 0) continue;

      const callRe = new RegExp(
        `\\b(${vars.join('|')})(?:\\.(?:rich|markup))?\\(\\s*(?:'([^']*)'|"([^"]*)"|\`([^\`]*)\`)`,
        'g',
      );
      for (const c of src.matchAll(callRe)) {
        const varName = c[1];
        if (varName === undefined) continue;
        const literal = c[2] ?? c[3];
        const template = c[4];
        if (template != null && template.includes('${')) continue; // dynamic — verified at runtime
        const raw = literal ?? template;
        if (raw == null) continue;
        const namespace = ns[varName];
        const full = namespace ? `${namespace}.${raw}` : raw;
        if (getKey(en, full) === undefined) missing.push(`${path.relative(SRC, file)}: ${full}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
