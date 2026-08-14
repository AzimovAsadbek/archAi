import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GLOBAL_RATE_LIMIT, RATE_LIMIT_TTL_MS } from './auth/auth.constants';
import { AuthModule } from './auth/auth.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigModule } from './config/app-config.module';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: RATE_LIMIT_TTL_MS, limit: GLOBAL_RATE_LIMIT }]),
    AppConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*splat');
  }
}
