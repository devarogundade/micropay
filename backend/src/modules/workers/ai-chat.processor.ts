import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_CHAT_QUEUE, AiChatJobPayload } from '../queue/queue.constants';
import { AiJobRunnerService } from './ai-job-runner.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiJobStatus } from '../../common/types/enums';

@Processor(AI_CHAT_QUEUE)
export class AiChatProcessor extends WorkerHost {
  private readonly logger = new Logger(AiChatProcessor.name);

  constructor(
    private readonly runner: AiJobRunnerService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<AiChatJobPayload>): Promise<unknown> {
    return this.runner.run({ ...job.data, type: job.data.type || 'chat' });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiChatJobPayload> | undefined, err: Error) {
    if (!job) return;
    this.logger.error(`ai.chat failed ${job.data.jobId}: ${err.message}`);
    this.realtime.emitJobFailed({
      jobId: job.data.jobId,
      status: AiJobStatus.failed,
      progress: 100,
      message: err.message,
      walletAddress: job.data.walletAddress,
    });
  }
}
