import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { UsageTrackingInterceptor } from './interceptors/usage.interceptor';
import { UsageModule } from '../modules/usage/usage.module';

@Module({
  imports: [UsageModule],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: UsageTrackingInterceptor },
  ],
})
export class CommonModule {}
