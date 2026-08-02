import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { ToolDefEntity } from '../../database/entities/tool-def.entity';
import { AiModule } from '../ai/ai.module';
import { ToolsRegistryService } from './tools-registry.service';
import { ToolsOrchestratorService } from './tools-orchestrator.service';
import { ToolsController } from './tools.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeDocEntity, ToolDefEntity]),
    forwardRef(() => AiModule),
  ],
  providers: [ToolsRegistryService, ToolsOrchestratorService],
  controllers: [ToolsController],
  exports: [ToolsRegistryService, ToolsOrchestratorService],
})
export class ToolsModule {}
