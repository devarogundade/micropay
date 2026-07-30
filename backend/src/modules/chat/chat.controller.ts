import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { ChatService } from './chat.service';

@Controller('api/v1/chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @SkipTransform()
  @Post('completions')
  async completions(
    @Body() body: Record<string, unknown>,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-async') asyncHeader?: string,
    @Query('async') asyncQuery?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const result = await this.chat.completions({
      body,
      paymentHeader: paymentSig || xPayment,
      walletAddress: wallet,
      asyncHeader,
      asyncQuery,
    });

    if (result.paymentRequired) {
      if ('headers' in result && result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res!.setHeader(k, v);
        }
      }
      return res!.status(result.status).json(result.body);
    }

    if ('paymentHeaders' in result && result.paymentHeaders) {
      for (const [k, v] of Object.entries(result.paymentHeaders)) {
        res!.setHeader(k, v);
      }
    }

    if ('stream' in result && result.stream === true) {
      const upstream = result.upstream;
      res!.status(upstream.status);
      const ctype = upstream.headers.get('content-type');
      if (ctype) res!.setHeader('Content-Type', ctype);
      res!.setHeader('Cache-Control', 'no-cache');
      res!.setHeader('Connection', 'keep-alive');

      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => '');
        try {
          return res!.status(upstream.status).json(JSON.parse(text));
        } catch {
          return res!.status(upstream.status).send(text);
        }
      }

      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res!.write(Buffer.from(value));
        }
        res!.end();
      };
      void pump().catch(() => {
        try {
          res!.end();
        } catch {
          /* ignore */
        }
      });
      return;
    }

    const jsonResult = result as {
      paymentRequired: false;
      status: number;
      body: Record<string, unknown>;
    };
    return res!.status(jsonResult.status).json(jsonResult.body);
  }

  @SkipTransform()
  @Get('sessions')
  async listSessions(
    @WalletAddress() wallet?: string,
    @Query('modelId') modelId?: string,
    @Query('latest') latest?: string,
  ) {
    if (!wallet) return { sessions: [] };
    if (latest === '1' && modelId) {
      return this.chat.getLatest(wallet, modelId);
    }
    return this.chat.listSessions(wallet, modelId);
  }

  @SkipTransform()
  @Post('sessions')
  async createOrPersist(
    @Body()
    body: {
      walletAddress?: string;
      modelId?: string;
      modelSlug?: string;
      title?: string;
      sessionId?: string | null;
      messages?: Array<Record<string, unknown>>;
      /** When true (or messages present), persist a turn instead of bare create */
      persist?: boolean;
    },
    @WalletAddress() wallet?: string,
  ) {
    const addr = wallet || body.walletAddress;
    if (!addr) {
      return {
        error: { message: 'Wallet required', type: 'validation_error' },
      };
    }
    if (!body.modelId) {
      return {
        error: { message: 'modelId required', type: 'validation_error' },
      };
    }

    if (body.persist || (body.messages && body.messages.length > 0)) {
      return this.chat.persistTurn({
        walletAddress: addr,
        modelId: body.modelId,
        modelSlug: body.modelSlug,
        sessionId: body.sessionId,
        title: body.title,
        messages: (body.messages ?? []) as Array<{
          id?: string;
          role: string;
          content: string;
          attachments?: Record<string, unknown>[];
          reasoning?: string;
          modelId?: string;
          costUsdc?: number;
          provider?: string;
          error?: boolean;
        }>,
      });
    }

    return this.chat.createSession({
      walletAddress: addr,
      modelId: body.modelId,
      modelSlug: body.modelSlug,
      title: body.title,
    });
  }

  @SkipTransform()
  @Get('sessions/:sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) return { session: null, messages: [] };
    return this.chat.getSession(wallet, sessionId);
  }

  @SkipTransform()
  @Delete('sessions/:sessionId')
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @Query('clear') clear?: string,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) return { sessionId, deleted: false, ok: false };
    const deleteSession = clear !== '1' && clear !== 'messages';
    return this.chat.clearSession(wallet, sessionId, deleteSession);
  }
}
