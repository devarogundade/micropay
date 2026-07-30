import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiJobEntity } from '../../database/entities/ai-job.entity';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { ImageJobEntity } from '../../database/entities/image-job.entity';
import { TranscriptionEntity } from '../../database/entities/transcription.entity';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiModule } from '../ai/ai.module';
import { ImagesModule } from '../images/images.module';
import { ToolsModule } from '../tools/tools.module';
import { UsersModule } from '../users/users.module';
import { AiProcessProcessor } from './ai-process.processor';
import { AiEmbedProcessor } from './ai-embed.processor';
import { AiImageProcessor } from './ai-image.processor';
import { AiChatProcessor } from './ai-chat.processor';
import { AiAudioProcessor } from './ai-audio.processor';
import { AiIdeProcessor } from './ai-ide.processor';
import { AiJobRunnerService } from './ai-job-runner.service';

@Module({
  imports: [
    QueueModule,
    RealtimeModule,
    AiModule,
    ToolsModule,
    UsersModule,
    forwardRef(() => ImagesModule),
    TypeOrmModule.forFeature([
      AiJobEntity,
      KnowledgeDocEntity,
      ImageJobEntity,
      TranscriptionEntity,
    ]),
  ],
  providers: [
    AiJobRunnerService,
    AiProcessProcessor,
    AiEmbedProcessor,
    AiImageProcessor,
    AiChatProcessor,
    AiAudioProcessor,
    AiIdeProcessor,
  ],
})
export class WorkersModule {}
