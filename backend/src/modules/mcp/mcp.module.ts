import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { IdeModule } from '../ide/ide.module';
import { McpController } from './mcp.controller';

@Module({
  imports: [AiModule, IdeModule],
  controllers: [McpController],
})
export class McpModule {}
