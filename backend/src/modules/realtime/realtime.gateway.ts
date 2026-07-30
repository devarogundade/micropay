import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AiJobStatus } from '../../common/types/enums';

export type JobProgressEvent = {
  jobId: string;
  status: string;
  progress: number;
  message?: string;
  result?: unknown;
  walletAddress?: string;
};

export type UsageEvent = {
  walletAddress?: string;
  kind: string;
  costUsdc?: number;
  model?: string;
  endpoint?: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const wallet =
      (client.handshake.auth?.walletAddress as string | undefined) ||
      (client.handshake.query?.wallet as string | undefined);
    if (wallet) {
      void client.join(this.walletRoom(wallet));
      this.logger.debug(`WS connected ${client.id} wallet=${wallet}`);
    } else {
      this.logger.debug(`WS connected ${client.id} (anonymous)`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS disconnected ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { walletAddress?: string; rooms?: string[] },
  ) {
    if (body?.walletAddress) {
      void client.join(this.walletRoom(body.walletAddress));
    }
    for (const room of body?.rooms ?? []) {
      void client.join(room);
    }
    return { ok: true };
  }

  @SubscribeMessage('subscribeJob')
  handleSubscribeJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId: string },
  ) {
    if (body?.jobId) {
      void client.join(this.jobRoom(body.jobId));
    }
    return { ok: true };
  }

  /** Emit progress; also fans out terminal events as job.completed / job.failed. */
  emitJobProgress(event: JobProgressEvent) {
    this.emitToRooms(event.jobId, event.walletAddress, 'job.progress', event);
    const st = String(event.status || '').toLowerCase();
    if (st === AiJobStatus.completed || st === 'completed' || st === 'succeeded') {
      this.emitToRooms(event.jobId, event.walletAddress, 'job.completed', event);
    } else if (st === AiJobStatus.failed || st === 'failed' || st === 'error') {
      this.emitToRooms(event.jobId, event.walletAddress, 'job.failed', event);
    }
  }

  emitJobCompleted(event: JobProgressEvent) {
    this.emitToRooms(event.jobId, event.walletAddress, 'job.progress', {
      ...event,
      status: AiJobStatus.completed,
      progress: event.progress ?? 100,
    });
    this.emitToRooms(event.jobId, event.walletAddress, 'job.completed', event);
  }

  emitJobFailed(event: JobProgressEvent) {
    this.emitToRooms(event.jobId, event.walletAddress, 'job.progress', {
      ...event,
      status: AiJobStatus.failed,
      progress: event.progress ?? 100,
    });
    this.emitToRooms(event.jobId, event.walletAddress, 'job.failed', event);
  }

  private emitToRooms(
    jobId: string,
    walletAddress: string | undefined,
    event: string,
    payload: unknown,
  ) {
    this.server.to(this.jobRoom(jobId)).emit(event, payload);
    if (walletAddress) {
      this.server.to(this.walletRoom(walletAddress)).emit(event, payload);
    }
    this.server.emit(event, payload);
  }

  emitUsage(event: UsageEvent) {
    if (event.walletAddress) {
      this.server
        .to(this.walletRoom(event.walletAddress))
        .emit('usage.updated', event);
    }
    this.server.emit('usage.updated', event);
  }

  walletRoom(wallet: string) {
    return `wallet:${wallet}`;
  }

  jobRoom(jobId: string) {
    return `job:${jobId}`;
  }
}
