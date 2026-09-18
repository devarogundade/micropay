import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AgentStatus,
  AgentType,
} from '../../../common/types/enums';

export class AgentKnowledgeDto {
  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(60_000)
  content!: string;
}

export class CreateAgentDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsIn([AgentType.chat, AgentType.image, AgentType.audio])
  type!: AgentType | string;

  @IsString()
  @MaxLength(200)
  modelId!: string;

  @IsNumber()
  @Min(0.01)
  @Max(10)
  priceUsdc!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentKnowledgeDto)
  knowledge?: AgentKnowledgeDto[];

  @IsOptional()
  @IsIn([AgentStatus.published, AgentStatus.draft])
  status?: AgentStatus | string;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn([AgentType.chat, AgentType.image, AgentType.audio])
  type?: AgentType | string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  priceUsdc?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentKnowledgeDto)
  knowledge?: AgentKnowledgeDto[];

  @IsOptional()
  @IsIn([AgentStatus.published, AgentStatus.paused, AgentStatus.draft])
  status?: AgentStatus | string;
}

export class RequestWithdrawalDto {
  @IsNumber()
  @Min(1)
  @Max(10_000_000)
  amountUsdc!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  destinationAddress?: string;
}