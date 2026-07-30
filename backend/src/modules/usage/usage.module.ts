import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageRecordEntity } from '../../database/entities/usage-record.entity';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UsageRecordEntity])],
  providers: [UsageService],
  controllers: [UsageController],
  exports: [UsageService],
})
export class UsageModule {}
