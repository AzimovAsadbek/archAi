import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Bundled font files. Manrope ships as a variable TTF upstream, which pdfkit
 * would embed at its default instance (ExtraLight) with no way to reach Bold —
 * so the two static instances built by `@expo-google-fonts/manrope` are vendored
 * instead, together with the OFL licence they are distributed under.
 */
export const FONT_FILES = {
  regular: 'Manrope-Regular.ttf',
  bold: 'Manrope-Bold.ttf',
} as const;

/** How far up the tree the assets directory is looked for. */
const MAX_DEPTH = 6;

/**
 * Locates `assets/fonts` from wherever this module happens to live.
 *
 * The same file runs from three roots: `src/pdf/` under vitest/swc, `dist/pdf/`
 * after `nest build` (which copies `assets/**` to `dist/assets` — see
 * nest-cli.json), and the package root when only `process.cwd()` is known. A
 * walk up the parents resolves all three without a build-time constant.
 */
function locateFontsDir(): string {
  const starts = [typeof __dirname === 'string' ? __dirname : process.cwd(), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const candidate = join(dir, 'assets', 'fonts');
      if (existsSync(join(candidate, FONT_FILES.regular))) {
        return candidate;
      }
      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }
  throw new Error(
    `Bundled PDF fonts not found — expected assets/fonts/${FONT_FILES.regular} near ${starts[0] ?? ''}`,
  );
}

let cached: { regular: string; bold: string } | null = null;

/** Absolute paths of the two embedded fonts, resolved once per process. */
export function fontPaths(): { regular: string; bold: string } {
  if (cached === null) {
    const dir = locateFontsDir();
    cached = { regular: join(dir, FONT_FILES.regular), bold: join(dir, FONT_FILES.bold) };
  }
  return cached;
}
