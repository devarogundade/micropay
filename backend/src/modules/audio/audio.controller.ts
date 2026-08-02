import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { AudioService } from './audio.service';
import { MAX_UPLOAD_BYTES } from '../storage/storage.service';

@Controller('api/v1/audio')
export class AudioController {
  constructor(private readonly audio: AudioService) {}

  @SkipTransform()
  @Post('transcriptions')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  async transcriptions(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Headers('payment-signature') paymentSig?: string,
    @Headers('x-payment') xPayment?: string,
    @Headers('x-micropay-request-id') requestId?: string,
    @Headers('x-async') asyncHeader?: string,
    @WalletAddress() wallet?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    const body = req.body as Record<string, string> | undefined;
    const asyncOnly =
      asyncHeader === '1' ||
      asyncHeader === 'true' ||
      body?.async === '1' ||
      body?.async === 'true';
    const result = await this.audio.transcribe({
      file,
      model: body?.model,
      language: body?.language,
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
    return this.audio.history(wallet);
  }
}
