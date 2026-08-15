import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AUTH_COOKIES } from './auth/auth.constants';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfigService } from './config/app-config.service';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'docs';

/**
 * Single source of truth for the HTTP layer setup — shared by `main.ts`
 * and the e2e test harness so both exercise identical behaviour.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);

  // Trust exactly the configured number of proxy hops so the rate limiter and
  // `req.ip` see the real client IP behind a TLS-terminating proxy, not the
  // proxy's address (which would collapse every user into one per-IP bucket).
  // Default 0 = no proxy trusted.
  const httpAdapter = app.getHttpAdapter();
  if (typeof httpAdapter.getInstance === 'function') {
    const instance = httpAdapter.getInstance() as { set?: (k: string, v: unknown) => void };
    instance.set?.('trust proxy', config.trustProxyHops);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
    // Lets the browser read the PDF export filename cross-origin.
    exposedHeaders: ['Content-Disposition'],
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new HttpExceptionFilter());
}

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('archAi API')
      .setDescription('archAi REST API — projects, configuration and auth')
      .setVersion('1.0')
      .addCookieAuth(AUTH_COOKIES.access)
      .build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, () => document);
}
