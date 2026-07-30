import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSessionEntity } from '../../database/entities/chat-session.entity';
import { ChatMessageEntity } from '../../database/entities/chat-message.entity';
import { PaymentsModule } from '../payments/payments.module';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { ActivitiesModule } from '../activities/activities.module';
import { UsageModule } from '../usage/usage.module';
import { PricingModule } from '../pricing/pricing.module';
import { ToolsModule } from '../tools/tools.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSessionEntity, ChatMessageEntity]),
    PaymentsModule,
    AiModule,
    UsersModule,
    ActivitiesModule,
    UsageModule,
    PricingModule,
    ToolsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
