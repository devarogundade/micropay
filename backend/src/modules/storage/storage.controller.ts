import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { ok } from '../../common/dto/api-response.dto';
import { StorageService } from './storage.service';

class PresignDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  expiresIn?: number;
}

@Controller('api/v1/storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /** Legacy flat shape for app `uploadToStorage` (no envelope). */
  @SkipTransform()
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @WalletAddress() wallet?: string,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      return {
        error: { code: 'bad_request', message: 'file is required' },
      };
    }
    const asset = await this.storage.uploadBuffer({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: folder || undefined,
      walletAddress: wallet,
    });
    return {
      url: asset.url,
      storagePath: asset.key,
      size: asset.sizeBytes,
      mimeType: asset.mimeType ?? file.mimetype,
      name: asset.originalName ?? file.originalname,
      bucket: asset.bucket,
    };
  }

  @Post('presign')
  async presign(@Body() body: PresignDto) {
    const result = await this.storage.getPresignedUploadUrl(body);
    return ok(result);
  }

  @Get('presign-download')
  async presignDownload(@Query('key') key: string) {
    const result = await this.storage.getPresignedDownloadUrl(key);
    return ok(result);
  }
}
