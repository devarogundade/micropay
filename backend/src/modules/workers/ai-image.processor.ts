import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageJobEntity } from '../../database/entities/image-job.entity';
import {
  AI_IMAGE_QUEUE,
  AiImageJobPayload,
} from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiService } from '../ai/ai.service';
import { ImagesService } from '../images/images.service';

@Processor(AI_IMAGE_QUEUE)
export class AiImageProcessor extends WorkerHost {
  private readonly logger = new Logger(AiImageProcessor.name);

  constructor(
    @InjectRepository(ImageJobEntity)
    private readonly imageJobs: Repository<ImageJobEntity>,
    private readonly realtime: RealtimeGateway,
    private readonly ai: AiService,
    private readonly images: ImagesService,
  ) {
    super();
  }

  async process(job: Job<AiImageJobPayload>): Promise<unknown> {
    const { imageJobId, model, prompt, size, walletAddress } = job.data;
    await this.patch(imageJobId, 'active');
    this.realtime.emitJobProgress({
      jobId: imageJobId,
      status: 'active',
      progress: 10,
      message: 'generating',
      walletAddress,
    });

    const { data } = await this.ai.generateImageSynced({
      model,
      prompt,
      size,
      response_format: 'b64_json',
    });

    this.realtime.emitJobProgress({
      jobId: imageJobId,
      status: 'active',
      progress: 70,
      message: 'persisting',
      walletAddress,
    });

    const persisted = await this.images.persistImages(data, {
      walletAddress,
      model: model || 'unknown',
      prompt,
      size: size ?? null,
    });

    await this.patch(imageJobId, 'completed');
    this.realtime.emitJobCompleted({
      jobId: imageJobId,
      status: 'completed',
      progress: 100,
      message: 'done',
      result: persisted,
      walletAddress,
    });
    return persisted;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AiImageJobPayload> | undefined, err: Error) {
    if (!job) return;
    this.logger.error(`ai.image failed ${job.data.imageJobId}: ${err.message}`);
    await this.patch(job.data.imageJobId, 'failed', err.message);
    this.realtime.emitJobFailed({
      jobId: job.data.imageJobId,
      status: 'failed',
      progress: 100,
      message: err.message,
      walletAddress: job.data.walletAddress,
    });
  }

  private async patch(
    id: string,
    status: string,
    errorMessage?: string,
  ) {
    await this.imageJobs.update(
      { id },
      {
        status,
        errorMessage: errorMessage ?? null,
      },
    );
  }
}
