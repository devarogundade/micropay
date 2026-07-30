import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';

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
          synchronize: config.get<boolean>('database.sync') ?? false,
          logging: config.get<boolean>('database.logging') ?? false,
          ssl: url?.includes('localhost')
            ? false
            : { rejectUnauthorized: false },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
