import { ActivityEntity } from './activity.entity';
import { AiJobEntity } from './ai-job.entity';
import { ApiKeyEntity } from './api-key.entity';
import { ChatMessageEntity } from './chat-message.entity';
import { ChatSessionEntity } from './chat-session.entity';
import { CodeActivityEntity } from './code-activity.entity';
import { CodeTemplateCloneEntity } from './code-template-clone.entity';
import { CodeTemplateEntity } from './code-template.entity';
import { CodeUserModelUsageEntity } from './code-user-model-usage.entity';
import { CodeUserEntity } from './code-user.entity';
import { FileAssetEntity } from './file-asset.entity';
import { ImageGenerationEntity } from './image-generation.entity';
import { ImageJobEntity } from './image-job.entity';
import { KnowledgeDocEntity } from './knowledge-doc.entity';
import { PricingRuleEntity } from './pricing-rule.entity';
import { SettingEntity } from './setting.entity';
import { ToolDefEntity } from './tool-def.entity';
import { TranscriptionEntity } from './transcription.entity';
import { UsageRecordEntity } from './usage-record.entity';
import { UserModelUsageEntity } from './user-model-usage.entity';
import { UserEntity } from './user.entity';
import { CreditUsageEntity } from './credit-usage.entity';
import { WalletDailyCreditEntity } from './wallet-daily-credit.entity';

export const ALL_ENTITIES = [
  UserEntity,
  ActivityEntity,
  ChatSessionEntity,
  ChatMessageEntity,
  ImageGenerationEntity,
  ImageJobEntity,
  UserModelUsageEntity,
  TranscriptionEntity,
  ApiKeyEntity,
  CodeUserEntity,
  CodeActivityEntity,
  CodeUserModelUsageEntity,
  CodeTemplateEntity,
  CodeTemplateCloneEntity,
  SettingEntity,
  PricingRuleEntity,
  UsageRecordEntity,
  AiJobEntity,
  FileAssetEntity,
  KnowledgeDocEntity,
  ToolDefEntity,
  WalletDailyCreditEntity,
  CreditUsageEntity,
];

export {
  UserEntity,
  ActivityEntity,
  ChatSessionEntity,
  ChatMessageEntity,
  ImageGenerationEntity,
  ImageJobEntity,
  UserModelUsageEntity,
  TranscriptionEntity,
  ApiKeyEntity,
  CodeUserEntity,
  CodeActivityEntity,
  CodeUserModelUsageEntity,
  CodeTemplateEntity,
  CodeTemplateCloneEntity,
  SettingEntity,
  PricingRuleEntity,
  UsageRecordEntity,
  AiJobEntity,
  FileAssetEntity,
  KnowledgeDocEntity,
  ToolDefEntity,
  WalletDailyCreditEntity,
  CreditUsageEntity,
};
