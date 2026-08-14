import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX, configureApp, SWAGGER_PATH, setupSwagger } from './app.setup';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  configureApp(app);
  app.enableShutdownHooks();

  if (!config.isProduction) {
    setupSwagger(app);
  }

  await app.listen(config.apiPort);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${config.apiPort}/${API_PREFIX}`);
  if (!config.isProduction) {
    logger.log(`Swagger UI on http://localhost:${config.apiPort}/${SWAGGER_PATH}`);
  }
}

void bootstrap();
