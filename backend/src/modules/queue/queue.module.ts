import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  AI_AUDIO_QUEUE,
  AI_CHAT_QUEUE,
  AI_EMBED_QUEUE,
  AI_IDE_QUEUE,
  AI_IMAGE_QUEUE,
  AI_PROCESS_QUEUE,
} from './queue.constants';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          db: config.get<number>('redis.db') ?? 0,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: AI_PROCESS_QUEUE },
      { name: AI_EMBED_QUEUE },
      { name: AI_IMAGE_QUEUE },
      { name: AI_CHAT_QUEUE },
      { name: AI_AUDIO_QUEUE },
      { name: AI_IDE_QUEUE },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
