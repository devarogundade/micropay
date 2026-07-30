import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { UsageModule } from '../usage/usage.module';
import { IdeModule } from '../ide/ide.module';
import { AiModule } from '../ai/ai.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    AuthModule,
    SettingsModule,
    PricingModule,
    UsageModule,
    IdeModule,
    AiModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
