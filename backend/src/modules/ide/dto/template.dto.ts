import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateFileDto {
  @IsString()
  path!: string;

  @IsString()
  content!: string;
}

export class CreateTemplateDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  projectName!: string;

  @IsString()
  activePath!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateFileDto)
  files!: TemplateFileDto[];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  activePath?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFileDto)
  files?: TemplateFileDto[];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
