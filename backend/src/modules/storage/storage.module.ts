import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileAssetEntity } from '../../database/entities/file-asset.entity';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FileAssetEntity])],
  providers: [StorageService],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
