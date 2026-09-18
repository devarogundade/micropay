import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './modules/queue/queue.module';
import { WorkersModule } from './modules/workers/workers.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsageModule } from './modules/usage/usage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AdminModule } from './modules/admin/admin.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AiModule } from './modules/ai/ai.module';
import { ToolsModule } from './modules/tools/tools.module';
import { IdeModule } from './modules/ide/ide.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { ChatModule } from './modules/chat/chat.module';
import { ImagesModule } from './modules/images/images.module';
import { AudioModule } from './modules/audio/audio.module';
import { HealthModule } from './modules/health/health.module';
import { McpModule } from './modules/mcp/mcp.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { AgentsModule } from './modules/agents/agents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      // Dual-network: copy .env.testnet or .env.mainnet → .env.local
      envFilePath: [
        `.env.${process.env.NETWORK ?? 'testnet'}.local`,
        `.env.${process.env.NETWORK ?? 'testnet'}`,
        '.env.local',
        '.env',
      ],
    }),
    CommonModule,
    DatabaseModule,
    QueueModule,
    WorkersModule,
    RealtimeModule,
    StorageModule,
    UsageModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    PricingModule,
    AdminModule,
    PaymentsModule,
    AiModule,
    ToolsModule,
    IdeModule,
    ActivitiesModule,
    ChatModule,
    ImagesModule,
    AudioModule,
HealthModule,
    McpModule,
    DiscoveryModule,
    AgentsModule,
  ],
})
export class AppModule {}
