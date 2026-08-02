import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsOptional, IsString } from 'class-validator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { IdeService } from './ide.service';
import type { TemplateSort } from './ide.service';

class CloneDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

@Controller('api/v1')
export class IdeController {
  constructor(private readonly ide: IdeService) {}

  @SkipTransform()
  @Get('templates')
  async listTemplates(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    const allowed: TemplateSort[] = [
      'popular',
      'newest',
      'name',
      'clones-asc',
      'clones-desc',
    ];
    const sortSafe = allowed.includes(sort as TemplateSort)
      ? (sort as TemplateSort)
      : 'popular';
    return this.ide.listTemplates({ q, category, sort: sortSafe });
  }

  @SkipTransform()
  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.ide.getTemplate(id);
  }

  @SkipTransform()
  @Post('clone')
  async clone(
    @Body() body: CloneDto,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-micropay-request-id') requestId?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const result = await this.ide.cloneTemplate({
      ...body,
      paymentHeader: paymentSig || xPayment,
      walletAddress: wallet,
      requestId,
    });
    if (result.paymentRequired) {
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res!.setHeader(k, v);
        }
      }
      return res!.status(result.status ?? 402).json(result.body);
    }
    if (result.paymentHeaders) {
      for (const [k, v] of Object.entries(result.paymentHeaders)) {
        res!.setHeader(k, v);
      }
    }
    return res!.status(200).json({
      template: result.template,
      costUsdc: result.costUsdc,
      credit: result.credit,
      txId: result.txId,
    });
  }

  @SkipTransform()
  @Post('ide/agent')
  async agent(
    @Body() body: Record<string, unknown>,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-micropay-request-id') requestId?: string,
    @Headers('x-async') asyncHeader?: string,
    @Query('async') asyncQuery?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const asyncOnly =
      asyncHeader === '1' ||
      asyncHeader === 'true' ||
      asyncQuery === '1' ||
      asyncQuery === 'true';
    const result = await this.ide.runAgent({
      body,
      paymentHeader: paymentSig || xPayment,
      walletAddress: wallet,
      asyncOnly,
      requestId,
    });
    if (result.paymentRequired) {
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res!.setHeader(k, v);
        }
      }
      return res!.status(result.status ?? 402).json(result.body);
    }
    if (result.paymentHeaders) {
      for (const [k, v] of Object.entries(result.paymentHeaders)) {
        res!.setHeader(k, v);
      }
    }
    if ('body' in result && result.body) {
      return res!.status(result.status ?? 200).json(result.body);
    }
    return res!.status(result.status ?? 200).json(result);
  }

  @SkipTransform()
  @Post('puya-ts/compile')
  async compile(
    @Body()
    body: {
      source?: string;
      files?: Array<{ path: string; content: string }>;
      entry?: string;
    },
    @Res({ passthrough: false }) res?: Response,
  ) {
    const result = await this.ide.compile(body);
    if ('body' in result && result.body && result.ok === false) {
      return res!.status(result.status ?? 422).json(result.body);
    }
    return res!.status(200).json(result);
  }
}
