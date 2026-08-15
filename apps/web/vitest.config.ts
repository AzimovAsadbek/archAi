import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Pure-logic unit tests (lib helpers, i18n catalog integrity). Components that
// need a DOM are covered by the browser/E2E layer, so a node environment keeps
// these fast; `@/` mirrors the tsconfig path alias.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
