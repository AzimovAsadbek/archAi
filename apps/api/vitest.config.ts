import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      // ESM output: vitest evaluates modules natively. With `commonjs` the emitted
      // require() calls bypass vite's resolver, so `vitest` and relative TS imports
      // both fail to load (see NestJS vitest recipe).
      module: { type: 'es6' },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
