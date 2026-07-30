import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AI_AUDIO_QUEUE,
  AI_CHAT_QUEUE,
  AI_EMBED_QUEUE,
  AI_IDE_QUEUE,
  AI_IMAGE_QUEUE,
  AI_PROCESS_QUEUE,
  AiAudioJobPayload,
  AiChatJobPayload,
  AiEmbedJobPayload,
  AiIdeJobPayload,
  AiImageJobPayload,
  AiProcessJobPayload,
} from './queue.constants';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(AI_PROCESS_QUEUE) private readonly processQueue: Queue,
    @InjectQueue(AI_EMBED_QUEUE) private readonly embedQueue: Queue,
    @InjectQueue(AI_IMAGE_QUEUE) private readonly imageQueue: Queue,
    @InjectQueue(AI_CHAT_QUEUE) private readonly chatQueue: Queue,
    @InjectQueue(AI_AUDIO_QUEUE) private readonly audioQueue: Queue,
    @InjectQueue(AI_IDE_QUEUE) private readonly ideQueue: Queue,
  ) {}

  enqueueProcess(payload: AiProcessJobPayload) {
    return this.processQueue.add('process', payload, {
      jobId: payload.jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  enqueueEmbed(payload: AiEmbedJobPayload) {
    return this.embedQueue.add('embed', payload, {
      jobId: payload.jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  enqueueImage(payload: AiImageJobPayload) {
    return this.imageQueue.add('image', payload, {
      jobId: payload.jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  enqueueChat(payload: AiChatJobPayload) {
    return this.chatQueue.add('chat', payload, {
      jobId: payload.jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  enqueueAudio(payload: AiAudioJobPayload) {
    return this.audioQueue.add('audio', payload, {
      jobId: payload.jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  enqueueIde(payload: AiIdeJobPayload) {
    return this.ideQueue.add('ide', payload, {
      jobId: payload.jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
