// Vercel serverless entry.
//
// A three-line CommonJS shim on purpose. Vercel compiles files under `api/`
// with esbuild, which strips types without emitting `design:*` decorator
// metadata — Nest's dependency injection reads exactly that metadata, so a
// TypeScript handler here would build cleanly and then fail to resolve a single
// provider at runtime. `nest build` (tsc, `emitDecoratorMetadata: true`) emits
// the real thing, so the handler is required from `dist/` instead.
//
// `dist/` is produced by the build command in vercel.json and pulled into the
// bundle by `includeFiles`.
module.exports = require('../dist/serverless').default;
