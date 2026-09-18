import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../../database/entities/agent.entity';
import { AgentPaymentEntity } from '../../database/entities/agent-payment.entity';
import { CreatorBalanceEntity } from '../../database/entities/creator-balance.entity';
import { WithdrawalRequestEntity } from '../../database/entities/withdrawal.entity';
import { PaymentsModule } from '../payments/payments.module';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { ActivitiesModule } from '../activities/activities.module';
import { UsageModule } from '../usage/usage.module';
import { ImagesModule } from '../images/images.module';
import { AudioModule } from '../audio/audio.module';
import { AuthModule } from '../auth/auth.module';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentsAdminController } from './agents.admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      AgentPaymentEntity,
      CreatorBalanceEntity,
      WithdrawalRequestEntity,
    ]),
    PaymentsModule,
    AiModule,
    UsersModule,
    ActivitiesModule,
    UsageModule,
    ImagesModule,
    AudioModule,
    AuthModule,
  ],
  providers: [AgentsService],
  controllers: [AgentsController, AgentsAdminController],
  exports: [AgentsService],
})
export class AgentsModule {}