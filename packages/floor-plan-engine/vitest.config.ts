import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /**
     * The geometry suites are CPU-bound, not I/O-bound: the seeded fuzz runs
     * 5,000 configurations and the degenerate-input invariant sweeps a whole
     * fixture table. Both comfortably exceed vitest's 5 s default whenever the
     * machine is busy — `pnpm -r test` runs five packages at once, and a CI
     * runner is busier still — which made `invariant 8` fail intermittently
     * under load while passing in isolation. These ceilings are generous on
     * purpose: they exist to stop contention masquerading as a regression,
     * never to let a genuinely slow engine change slip through unnoticed.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
