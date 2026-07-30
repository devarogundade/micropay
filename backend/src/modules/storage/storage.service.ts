import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { FileAssetEntity } from '../../database/entities/file-asset.entity';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(FileAssetEntity)
    private readonly assets: Repository<FileAssetEntity>,
  ) {}

  private getS3(): S3Client {
    if (this.client) return this.client;
    const region = this.config.get<string>('s3.region') ?? 'us-east-1';
    const accessKeyId = this.config.get<string>('s3.accessKeyId');
    const secretAccessKey = this.config.get<string>('s3.secretAccessKey');
    const endpoint = this.config.get<string>('s3.endpoint');

    if (!accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException({
        code: 'storage_not_configured',
        message:
          'AWS S3 credentials missing. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET.',
      });
    }

    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint
        ? { endpoint, forcePathStyle: true }
        : {}),
    });
    return this.client;
  }

  private bucket(): string {
    const b = this.config.get<string>('s3.bucket');
    if (!b) {
      throw new ServiceUnavailableException({
        code: 'storage_not_configured',
        message: 'AWS_S3_BUCKET is required',
      });
    }
    return b;
  }

  async uploadBuffer(input: {
    buffer: Buffer;
    mimeType?: string;
    originalName?: string;
    folder?: string;
    walletAddress?: string;
    userId?: string;
  }): Promise<FileAssetEntity> {
    if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        code: 'file_too_large',
        message: `File exceeds ${MAX_UPLOAD_BYTES} byte limit`,
      });
    }

    const bucket = this.bucket();
    const key = `${input.folder ?? 'uploads'}/${randomUUID()}-${input.originalName ?? 'file'}`;
    const client = this.getS3();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    const publicBase = this.config.get<string>('s3.publicBaseUrl');
    const url = publicBase
      ? `${publicBase.replace(/\/$/, '')}/${key}`
      : `s3://${bucket}/${key}`;

    return this.assets.save(
      this.assets.create({
        bucket,
        key,
        url,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.buffer.byteLength,
        originalName: input.originalName ?? null,
        walletAddress: input.walletAddress ?? null,
        userId: input.userId ?? null,
        provider: 's3',
      }),
    );
  }

  async getPresignedUploadUrl(input: {
    key?: string;
    mimeType?: string;
    expiresIn?: number;
    folder?: string;
  }) {
    const bucket = this.bucket();
    const key =
      input.key ??
      `${input.folder ?? 'uploads'}/${randomUUID()}`;
    const client = this.getS3();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.mimeType,
    });
    const url = await getSignedUrl(client, command, {
      expiresIn: input.expiresIn ?? 900,
    });
    return { url, bucket, key, expiresIn: input.expiresIn ?? 900 };
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 900) {
    const bucket = this.bucket();
    const client = this.getS3();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
    return { url, bucket, key, expiresIn };
  }
}
