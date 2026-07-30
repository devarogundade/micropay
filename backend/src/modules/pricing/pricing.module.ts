import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingRuleEntity } from '../../database/entities/pricing-rule.entity';
import { PricingService } from './pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRuleEntity])],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
