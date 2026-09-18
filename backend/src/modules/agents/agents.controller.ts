import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { AgentStatus } from '../../common/types/enums';
import { AgentsService } from './agents.service';
import {
  CreateAgentDto,
  RequestWithdrawalDto,
  UpdateAgentDto,
} from './dto/agent.dto';
import { MAX_UPLOAD_BYTES } from '../storage/storage.service';

@Controller('api/v1/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  // ── Creator ledger (declared before :slug) ─────────────────

  @Get('mine')
  async listMine(@WalletAddress() wallet?: string) {
    if (!wallet) return { items: [] };
    return { items: await this.agents.listMine(wallet) };
  }

  @Get('me/balance')
  async balance(@WalletAddress() wallet?: string) {
    if (!wallet) {
      return {
        availableUsdc: 0,
        lifetimeEarnedUsdc: 0,
        withdrawnUsdc: 0,
        pendingWithdrawalsUsdc: 0,
        balanceUsdc: 0,
        minWithdrawalUsdc: this.agents.getMinWithdrawalUsdc(),
      };
    }
    return this.agents.getBalance(wallet);
  }

  @Get('me/payments')
  async payments(
    @WalletAddress() wallet?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!wallet) return { items: [], total: 0, page: 1, limit: 20 };
    return this.agents.listPayments(
      wallet,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('me/withdrawals')
  async withdrawals(@WalletAddress() wallet?: string) {
    if (!wallet) return { items: [] };
    return { items: await this.agents.listWithdrawals(wallet) };
  }

  @Post('me/withdrawals')
  async requestWithdrawal(
    @Body() body: RequestWithdrawalDto,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) {
      throw new BadRequestException({
        error: { message: 'Wallet required', type: 'validation_error' },
      });
    }
    return this.agents.requestWithdrawal(wallet, body);
  }

  // ── Public discovery ───────────────────────────────────────

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('sort') sort?: string,
    @Query('creator') creator?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.agents.list({
      q,
      type,
      sort,
      creator,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return {
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  @Post()
  async create(
    @Body() body: CreateAgentDto,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) {
      throw new BadRequestException({
        error: { message: 'Wallet required', type: 'validation_error' },
      });
    }
    return this.agents.create(wallet, body);
  }

  // ── Paid prompt routes ─────────────────────────────────────

  @SkipTransform()
  @Post(':slug/chat')
  async chat(
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-micropay-request-id') requestId?: string,
    @Headers('x-async') asyncHeader?: string,
    @Query('async') asyncQuery?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const agent = await this.agents.getPublic(slug);
    const result = await this.agents.chatCompletions({
      agent,
      body,
      paymentHeader: paymentSig || xPayment,
      walletAddress: wallet,
      asyncHeader,
      asyncQuery,
      requestId,
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
  @Post(':slug/images')
  async images(
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-micropay-request-id') requestId?: string,
    @Query('async') asyncMode?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const agent = await this.agents.getPublic(slug);
    const result = await this.agents.generateImage({
      agent,
      body,
      paymentHeader: paymentSig || xPayment,
      walletAddress: wallet,
      requestId,
      asyncOnly: asyncMode === '1',
    });
    if (result.paymentRequired) {
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res!.setHeader(k, v);
        }
      }
      return res!.status(result.status).json(result.body);
    }
    if (result.paymentHeaders) {
      for (const [k, v] of Object.entries(result.paymentHeaders)) {
        res!.setHeader(k, v);
      }
    }
    return res!.status(result.status).json(result.body);
  }

  @SkipTransform()
  @Post(':slug/audio')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  async audio(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-micropay-request-id') requestId?: string,
    @Headers('x-async') asyncHeader?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const agent = await this.agents.getPublic(slug);
    const body = req.body as Record<string, string> | undefined;
    const asyncOnly =
      asyncHeader === '1' ||
      asyncHeader === 'true' ||
      body?.async === '1' ||
      body?.async === 'true';
    const result = await this.agents.transcribeAudio({
      agent,
      file,
      language: body?.language,
      paymentHeader: paymentSig || xPayment,
      walletAddress: wallet,
      requestId,
      asyncOnly,
    });
    if (result.paymentRequired) {
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res!.setHeader(k, v);
        }
      }
      return res!.status(result.status).json(result.body);
    }
    if (result.paymentHeaders) {
      for (const [k, v] of Object.entries(result.paymentHeaders)) {
        res!.setHeader(k, v);
      }
    }
    return res!.status(result.status).json(result.body);
  }

  // ── Public detail + owner management ───────────────────────

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    return this.agents.serializePublic(await this.agents.getPublic(slug));
  }

  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Body() body: UpdateAgentDto,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) {
      throw new BadRequestException({
        error: { message: 'Wallet required', type: 'validation_error' },
      });
    }
    return this.agents.update(wallet, slug, body);
  }

  @Post(':slug/pause')
  async pause(
    @Param('slug') slug: string,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) {
      throw new BadRequestException({
        error: { message: 'Wallet required', type: 'validation_error' },
      });
    }
    return this.agents.setStatus(wallet, slug, AgentStatus.paused);
  }

  @Post(':slug/publish')
  async publish(
    @Param('slug') slug: string,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) {
      throw new BadRequestException({
        error: { message: 'Wallet required', type: 'validation_error' },
      });
    }
    return this.agents.setStatus(wallet, slug, AgentStatus.published);
  }

  @Delete(':slug')
  async remove(
    @Param('slug') slug: string,
    @WalletAddress() wallet?: string,
  ) {
    if (!wallet) {
      throw new BadRequestException({
        error: { message: 'Wallet required', type: 'validation_error' },
      });
    }
    return this.agents.remove(wallet, slug);
  }
}