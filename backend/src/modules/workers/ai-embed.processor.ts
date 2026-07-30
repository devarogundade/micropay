import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import {
  AiJobEntity,
  AiJobStatus,
} from '../../database/entities/ai-job.entity';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { AI_EMBED_QUEUE, AiEmbedJobPayload } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Processor(AI_EMBED_QUEUE)
export class AiEmbedProcessor extends WorkerHost {
  private readonly logger = new Logger(AiEmbedProcessor.name);

  constructor(
    @InjectRepository(AiJobEntity)
    private readonly jobs: Repository<AiJobEntity>,
    @InjectRepository(KnowledgeDocEntity)
    private readonly docs: Repository<KnowledgeDocEntity>,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<AiEmbedJobPayload>): Promise<unknown> {
    const { jobId, knowledgeDocId } = job.data;
    await this.jobs.update(
      { id: jobId },
      { status: AiJobStatus.active, progress: 10, message: 'embedding' },
    );
    this.realtime.emitJobProgress({
      jobId,
      status: AiJobStatus.active,
      progress: 10,
      message: 'embedding',
      walletAddress: job.data.walletAddress,
    });

    const doc = await this.docs.findOne({ where: { id: knowledgeDocId } });
    // Embedding provider not configured — persist char stats for admin visibility.
    if (doc) {
      await this.docs.update(
        { id: doc.id },
        {
          embeddingMeta: {
            chars: doc.content.length,
            embeddedAt: new Date().toISOString(),
            note: 'Vector embed provider not configured; metadata only',
          },
        },
      );
    }

    const result = {
      knowledgeDocId,
      chars: doc?.content.length ?? 0,
      embedded: false,
    };
    await this.jobs.update(
      { id: jobId },
      {
        status: AiJobStatus.completed,
        progress: 100,
        message: 'done',
        result,
      },
    );
    this.realtime.emitJobProgress({
      jobId,
      status: AiJobStatus.completed,
      progress: 100,
      message: 'done',
      result,
      walletAddress: job.data.walletAddress,
    });
    return result;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AiEmbedJobPayload> | undefined, err: Error) {
    if (!job) return;
    this.logger.error(`ai.embed failed ${job.data.jobId}: ${err.message}`);
    await this.jobs.update(
      { id: job.data.jobId },
      { status: AiJobStatus.failed, progress: 100, error: err.message },
    );
    this.realtime.emitJobProgress({
      jobId: job.data.jobId,
      status: AiJobStatus.failed,
      progress: 100,
      message: err.message,
      walletAddress: job.data.walletAddress,
    });
  }
}
