import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';

  @IsOptional()
  @IsString()
  search?: string;

  /** JSON-encoded filter map, or use typed query fields on specific DTOs. */
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  get skip(): number {
    const page = this.page ?? 1;
    const limit = this.limit ?? 20;
    return (page - 1) * limit;
  }

  get take(): number {
    return this.limit ?? 20;
  }

  get sortOrder(): 'ASC' | 'DESC' {
    const o = (this.order ?? 'DESC').toUpperCase();
    return o === 'ASC' ? 'ASC' : 'DESC';
  }
}
