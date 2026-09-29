import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { MyReviewsController, PublicReviewsController } from './reviews.controller.js';
import { ReviewsAdminController } from './reviews-admin.controller.js';
import { ReviewsService } from './reviews.service.js';
import { ReviewsAdminService } from './reviews-admin.service.js';

@Module({
  imports: [IdentityModule, ProfilesModule, AdminModule],
  controllers: [MyReviewsController, PublicReviewsController, ReviewsAdminController],
  providers: [ReviewsService, ReviewsAdminService],
})
export class ReviewsModule {}
