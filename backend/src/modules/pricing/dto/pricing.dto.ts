import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  PricingNetworkScope,
  PricingProduct,
} from '../../../common/types/enums';

export class SetModelPriceDto {
  @IsNumber()
  @Min(0.000001)
  priceUsdc!: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PricingProduct)
  product?: PricingProduct;

  @IsOptional()
  @IsString()
  routeKind?: string;

  @IsOptional()
  @IsNumber()
  minUsdc?: number;

  @IsOptional()
  @IsNumber()
  maxUsdc?: number;

  @IsOptional()
  @IsString()
  network?: PricingNetworkScope | string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

/** Admin DTO for per-template clone pricing (`template:{slug}`). */
export class SetTemplatePriceDto extends SetModelPriceDto {}
