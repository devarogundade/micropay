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
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { ImagesService } from './images.service';

@Controller('api/v1/images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @SkipTransform()
  @Post('generations')
  async generations(
    @Body() body: Record<string, unknown>,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-micropay-request-id') requestId?: string,
    @Query('async') asyncMode?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const result = await this.images.generate({
      body,
      paymentHeader: paymentSig || xPayment,
      walletAddress: wallet,
      asyncOnly: asyncMode === '1',
      requestId,
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
  @Get('history')
  async history(@WalletAddress() wallet?: string) {
    return this.images.history(wallet);
  }

  @SkipTransform()
  @Get('jobs/:jobId')
  async job(@Param('jobId') jobId: string) {
    return this.images.getJob(jobId);
  }
}
