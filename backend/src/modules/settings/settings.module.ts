import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingEntity } from '../../database/entities/setting.entity';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SettingEntity])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
