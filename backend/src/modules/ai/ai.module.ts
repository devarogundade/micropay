import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiJobEntity } from '../../database/entities/ai-job.entity';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { ToolDefEntity } from '../../database/entities/tool-def.entity';
import { QueueModule } from '../queue/queue.module';
import { PricingModule } from '../pricing/pricing.module';
import { UsersModule } from '../users/users.module';
import { ProvidersModule } from '../providers/providers.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [
    QueueModule,
    PricingModule,
    UsersModule,
    ProvidersModule,
    TypeOrmModule.forFeature([
      AiJobEntity,
      KnowledgeDocEntity,
      ToolDefEntity,
    ]),
  ],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
