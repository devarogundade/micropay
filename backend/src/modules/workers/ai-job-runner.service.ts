import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiJobEntity,
  AiJobStatus,
  AiJobType,
} from '../../database/entities/ai-job.entity';
import { TranscriptionEntity } from '../../database/entities/transcription.entity';
import { AiService } from '../ai/ai.service';
import { ToolsOrchestratorService } from '../tools/tools-orchestrator.service';
import { ToolsRegistryService } from '../tools/tools-registry.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import type { AiProcessJobPayload } from '../queue/queue.constants';

/**
 * Shared runner for BullMQ AI jobs (chat / audio / ide / generic process).
 */
@Injectable()
export class AiJobRunnerService {
  private readonly logger = new Logger(AiJobRunnerService.name);

  constructor(
    @InjectRepository(AiJobEntity)
    private readonly jobs: Repository<AiJobEntity>,
    @InjectRepository(TranscriptionEntity)
    private readonly transcriptions: Repository<TranscriptionEntity>,
    private readonly ai: AiService,
    private readonly toolsOrchestrator: ToolsOrchestratorService,
    private readonly toolsRegistry: ToolsRegistryService,
    private readonly realtime: RealtimeGateway,
    private readonly users: UsersService,
  ) {}

  async run(payload: AiProcessJobPayload): Promise<unknown> {
    const { jobId, type } = payload;
    await this.patch(jobId, {
      status: AiJobStatus.active,
      progress: 5,
      message: 'started',
    });
    this.realtime.emitJobProgress({
      jobId,
      status: AiJobStatus.active,
      progress: 5,
      message: 'started',
      walletAddress: payload.walletAddress,
    });

    try {
      let result: Record<string, unknown>;
      switch (type) {
        case AiJobType.chat:
          result = await this.runChat(payload);
          break;
        case AiJobType.audio:
          result = await this.runAudio(payload);
          break;
        case AiJobType.ide_agent:
          result = await this.runIde(payload);
          break;
        default:
          result = {
            type,
            input: payload.input ?? {},
            model: payload.model ?? null,
            processedAt: new Date().toISOString(),
          };
      }

      await this.patch(jobId, {
        status: AiJobStatus.completed,
        progress: 100,
        message: 'done',
        result,
        error: null,
      });
      this.realtime.emitJobCompleted({
        jobId,
        status: AiJobStatus.completed,
        progress: 100,
        message: 'done',
        result,
        walletAddress: payload.walletAddress,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI job ${jobId} (${type}) failed: ${message}`);
      await this.patch(jobId, {
        status: AiJobStatus.failed,
        progress: 100,
        message,
        error: message,
      });
      this.realtime.emitJobFailed({
        jobId,
        status: AiJobStatus.failed,
        progress: 100,
        message,
        walletAddress: payload.walletAddress,
      });
      throw err;
    }
  }

  private async runChat(
    payload: AiProcessJobPayload,
  ): Promise<Record<string, unknown>> {
    const body = { ...(payload.input ?? {}) };
    this.realtime.emitJobProgress({
      jobId: payload.jobId,
      status: AiJobStatus.active,
      progress: 20,
      message: 'generating',
      walletAddress: payload.walletAddress,
    });

    const toolsEnabled = this.toolsRegistry.toolsGloballyEnabled();
    const clientDisabledTools = body.tools === null;

    if (toolsEnabled && !clientDisabledTools) {
      const result = await this.toolsOrchestrator.completeWithTools(body);
      this.realtime.emitJobProgress({
        jobId: payload.jobId,
        status: AiJobStatus.active,
        progress: 80,
        message: 'tools_done',
        walletAddress: payload.walletAddress,
      });
      return {
        ...result.data,
        micropay_tools: {
          used: result.usedTools,
          selected: result.selection.selectedToolNames,
          unknown: result.selection.unknownToolNames,
          invocations: result.toolInvocations.map((t) => ({
            name: t.name,
            ok: t.ok,
            durationMs: t.durationMs,
            error: t.error,
          })),
        },
      };
    }

    const completion = await this.ai.proxyChatCompletion({
      ...body,
      stream: false,
    });
    return completion.data;
  }

  private async runAudio(
    payload: AiProcessJobPayload,
  ): Promise<Record<string, unknown>> {
    const input = payload.input ?? {};
    const b64 = String(input.fileBase64 ?? '');
    if (!b64) {
      throw new Error('Missing audio payload (fileBase64)');
    }
    const buffer = Buffer.from(b64, 'base64');
    const model = String(input.model || payload.model || '');
    this.realtime.emitJobProgress({
      jobId: payload.jobId,
      status: AiJobStatus.active,
      progress: 30,
      message: 'transcribing',
      walletAddress: payload.walletAddress,
    });

    const { data } = await this.ai.createAudioTranscription({
      buffer,
      filename:
        typeof input.filename === 'string' ? input.filename : undefined,
      mimeType:
        typeof input.mimeType === 'string' ? input.mimeType : undefined,
      model,
      language:
        typeof input.language === 'string' ? input.language : undefined,
    });

    const text =
      data && typeof data === 'object' && 'text' in data
        ? String((data as { text: unknown }).text ?? '')
        : typeof data === 'string'
          ? data
          : JSON.stringify(data);

    if (payload.walletAddress) {
      const user = await this.users.ensureUser(payload.walletAddress);
      await this.transcriptions.save(
        this.transcriptions.create({
          userId: user.id,
          modelSlug: model,
          modelName: model,
          filename: typeof input.filename === 'string' ? input.filename : null,
          mimeType: typeof input.mimeType === 'string' ? input.mimeType : null,
          fileSize: typeof input.fileSize === 'number' ? input.fileSize : null,
          language:
            typeof input.language === 'string' ? input.language : null,
          text,
        }),
      );
    }

    return typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>)
      : { text };
  }

  private async runIde(
    payload: AiProcessJobPayload,
  ): Promise<Record<string, unknown>> {
    const body = { ...(payload.input ?? {}) };
    this.realtime.emitJobProgress({
      jobId: payload.jobId,
      status: AiJobStatus.active,
      progress: 25,
      message: 'enriching',
      walletAddress: payload.walletAddress,
    });
    const enriched = await this.ai.enrichIdeAgentBody(body);
    this.realtime.emitJobProgress({
      jobId: payload.jobId,
      status: AiJobStatus.active,
      progress: 50,
      message: 'generating',
      walletAddress: payload.walletAddress,
    });
    const completion = await this.ai.proxyChatCompletion({
      ...enriched,
      stream: false,
    });
    return completion.data;
  }

  private async patch(
    id: string,
    patch: Partial<
      Pick<
        AiJobEntity,
        'status' | 'progress' | 'message' | 'result' | 'error'
      >
    >,
  ) {
    await this.jobs.update({ id }, patch as never);
  }
}
