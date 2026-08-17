import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
import { configureApp } from './app.setup';
import { AppModule } from './app.module';

/**
 * Serverless entry point (Vercel).
 *
 * `main.ts` owns the long-running server: it binds a port and keeps the process
 * alive. A serverless platform gives us neither — it hands us a request and
 * expects a response — so the Nest application is built over a bare Express
 * instance and that instance is handed the request directly. Nothing here
 * listens on a port.
 *
 * The HTTP layer itself is `configureApp`, exactly as in `main.ts` and the e2e
 * harness, so helmet, cookie parsing, the global prefix and the error filter
 * behave identically whichever way the API is deployed.
 *
 * Swagger is deliberately absent: it is a development affordance and building
 * the document on a cold start would cost every first request.
 */

/**
 * The in-flight (or completed) bootstrap.
 *
 * Cached as a *promise* rather than the built server: a cold container can be
 * handed several concurrent requests before the first bootstrap resolves, and
 * caching the resolved value would let each of them start their own Nest
 * application. Awaiting one shared promise means the second request queues
 * behind the first instead of duplicating a ~1s startup and a second pool of
 * database connections.
 */
let bootstrap: Promise<Express> | null = null;

async function createServer(): Promise<Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    // No `debug`/`verbose`: on a serverless platform every line is billed log
    // volume, and the ones below error/warn say nothing an operator acts on.
    logger: ['error', 'warn', 'log'],
  });

  configureApp(app);
  await app.init();
  return server;
}

/** Warms the Nest application without serving a request. */
export function warm(): Promise<Express> {
  bootstrap ??= createServer();
  return bootstrap;
}

/**
 * Vercel Node handler. Typed structurally rather than against `@vercel/node` so
 * the API package keeps no build-time dependency on the platform it happens to
 * be deployed to.
 */
export default async function handler(req: unknown, res: unknown): Promise<void> {
  const server = await warm();
  (server as unknown as (a: unknown, b: unknown) => void)(req, res);
}
