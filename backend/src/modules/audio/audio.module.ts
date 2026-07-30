import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranscriptionEntity } from '../../database/entities/transcription.entity';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { ActivitiesModule } from '../activities/activities.module';
import { UsageModule } from '../usage/usage.module';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TranscriptionEntity]),
    PaymentsModule,
    PricingModule,
    AiModule,
    UsersModule,
    ActivitiesModule,
    UsageModule,
  ],
  controllers: [AudioController],
  providers: [AudioService],
})
export class AudioModule {}
