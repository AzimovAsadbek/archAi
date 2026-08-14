import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminEstimateRulesService } from './admin-estimate-rules.service';
import { AdminProjectsService } from './admin-projects.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AuditService } from './audit.service';

/**
 * Admin panel (docs/admin.md). `AuthModule` is imported for `TokenService`, so a
 * deactivation revokes sessions through the same code path as refresh-token
 * theft mitigation instead of a second implementation.
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [
    AdminGuard,
    AuditService,
    AdminUsersService,
    AdminProjectsService,
    AdminEstimateRulesService,
  ],
  // Reused by the public-content admin surface (ContentModule) so its /admin/*
  // routes sit behind the same guard and write to the same audit trail.
  exports: [AdminGuard, AuditService],
})
export class AdminModule {}
