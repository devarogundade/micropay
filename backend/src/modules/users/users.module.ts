import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { UserModelUsageEntity } from '../../database/entities/user-model-usage.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserModelUsageEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
