import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AdminBlogController } from './admin-blog.controller';
import { AdminFaqController } from './admin-faq.controller';
import { AdminPricingController } from './admin-pricing.controller';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

/**
 * Public content & pricing (docs/public-content.md): FAQ, blog and pricing.
 * Public reads are `@Public`; the `/admin/*` CRUD controllers reuse `AdminGuard`
 * and `AuditService` from `AdminModule`, so they sit behind the same role check
 * and write to the same audit trail as the rest of the admin surface.
 */
@Module({
  imports: [AdminModule],
  controllers: [
    FaqController,
    BlogController,
    PricingController,
    AdminFaqController,
    AdminBlogController,
    AdminPricingController,
  ],
  providers: [FaqService, BlogService, PricingService],
})
export class ContentModule {}
