import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileAssetEntity } from '../../database/entities/file-asset.entity';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { PdfExtractionService } from './pdf-extraction.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileAssetEntity])],
  providers: [StorageService, PdfExtractionService],
  controllers: [StorageController],
  exports: [StorageService, PdfExtractionService],
})
export class StorageModule {}
