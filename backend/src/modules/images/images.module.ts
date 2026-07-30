import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageJobEntity } from '../../database/entities/image-job.entity';
import { ImageGenerationEntity } from '../../database/entities/image-generation.entity';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { UsersModule } from '../users/users.module';
import { ActivitiesModule } from '../activities/activities.module';
import { UsageModule } from '../usage/usage.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageJobEntity, ImageGenerationEntity]),
    PaymentsModule,
    PricingModule,
    AiModule,
    StorageModule,
    QueueModule,
    UsersModule,
    ActivitiesModule,
    UsageModule,
    RealtimeModule,
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
