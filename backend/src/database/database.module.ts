import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import { AddImageJobResult1722600000000 } from './migrations/1722600000000-AddImageJobResult';
import { AddDailyCredits1722700000000 } from './migrations/1722700000000-AddDailyCredits';
import { SeedCodeTemplates1722800000000 } from './migrations/1722800000000-SeedCodeTemplates';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('database.url');
        return {
          type: 'postgres' as const,
          url,
          entities: ALL_ENTITIES,
          migrations: [
            AddImageJobResult1722600000000,
            AddDailyCredits1722700000000,
            SeedCodeTemplates1722800000000,
          ],
          synchronize: config.get<boolean>('database.sync') ?? false,
          logging: config.get<boolean>('database.logging') ?? false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
