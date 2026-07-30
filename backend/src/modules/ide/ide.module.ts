import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeTemplateEntity } from '../../database/entities/code-template.entity';
import { CodeTemplateCloneEntity } from '../../database/entities/code-template-clone.entity';
import { CodeUserEntity } from '../../database/entities/code-user.entity';
import { CodeActivityEntity } from '../../database/entities/code-activity.entity';
import { CodeUserModelUsageEntity } from '../../database/entities/code-user-model-usage.entity';
import { PaymentsModule } from '../payments/payments.module';
import { UsageModule } from '../usage/usage.module';
import { AiModule } from '../ai/ai.module';
import { PricingModule } from '../pricing/pricing.module';
import { IdeService } from './ide.service';
import { IdeController } from './ide.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CodeTemplateEntity,
      CodeTemplateCloneEntity,
      CodeUserEntity,
      CodeActivityEntity,
      CodeUserModelUsageEntity,
    ]),
    PaymentsModule,
    UsageModule,
    AiModule,
    PricingModule,
  ],
  providers: [IdeService],
  controllers: [IdeController],
  exports: [IdeService],
})
export class IdeModule {}
