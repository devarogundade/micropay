import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_AUDIO_QUEUE, AiAudioJobPayload } from '../queue/queue.constants';
import { AiJobRunnerService } from './ai-job-runner.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiJobStatus } from '../../common/types/enums';

@Processor(AI_AUDIO_QUEUE)
export class AiAudioProcessor extends WorkerHost {
  private readonly logger = new Logger(AiAudioProcessor.name);

  constructor(
    private readonly runner: AiJobRunnerService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<AiAudioJobPayload>): Promise<unknown> {
    return this.runner.run({ ...job.data, type: job.data.type || 'audio' });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiAudioJobPayload> | undefined, err: Error) {
    if (!job) return;
    this.logger.error(`ai.audio failed ${job.data.jobId}: ${err.message}`);
    this.realtime.emitJobFailed({
      jobId: job.data.jobId,
      status: AiJobStatus.failed,
      progress: 100,
      message: err.message,
      walletAddress: job.data.walletAddress,
    });
  }
}
