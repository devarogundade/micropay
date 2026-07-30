import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  AI_PROCESS_QUEUE,
  AiProcessJobPayload,
} from '../queue/queue.constants';
import { AiJobRunnerService } from './ai-job-runner.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiJobStatus } from '../../common/types/enums';

@Processor(AI_PROCESS_QUEUE)
export class AiProcessProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessProcessor.name);

  constructor(
    private readonly runner: AiJobRunnerService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<AiProcessJobPayload>): Promise<unknown> {
    return this.runner.run(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiProcessJobPayload> | undefined, err: Error) {
    if (!job) return;
    this.logger.error(`ai.process failed ${job.data.jobId}: ${err.message}`);
    // Runner already emits failure when it catches; this covers unexpected throws.
    this.realtime.emitJobFailed({
      jobId: job.data.jobId,
      status: AiJobStatus.failed,
      progress: 100,
      message: err.message,
      walletAddress: job.data.walletAddress,
    });
  }
}
