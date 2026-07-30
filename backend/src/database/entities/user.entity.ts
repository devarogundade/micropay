import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ActivityEntity } from './activity.entity';
import { ChatSessionEntity } from './chat-session.entity';
import { ImageGenerationEntity } from './image-generation.entity';
import { ImageJobEntity } from './image-job.entity';
import { TranscriptionEntity } from './transcription.entity';
import { UserModelUsageEntity } from './user-model-usage.entity';
import { ApiKeyEntity } from './api-key.entity';

/** App product wallet-keyed user (maps from Prisma `User`). */
@Entity({ name: 'User' })
export class UserEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  address!: string;

  @Column({ type: 'varchar', nullable: true })
  displayName!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ActivityEntity, (a) => a.user)
  activities!: ActivityEntity[];

  @OneToMany(() => ChatSessionEntity, (s) => s.user)
  chatSessions!: ChatSessionEntity[];

  @OneToMany(() => ImageGenerationEntity, (g) => g.user)
  imageGenerations!: ImageGenerationEntity[];

  @OneToMany(() => ImageJobEntity, (j) => j.user)
  imageJobs!: ImageJobEntity[];

  @OneToMany(() => TranscriptionEntity, (t) => t.user)
  transcriptions!: TranscriptionEntity[];

  @OneToMany(() => UserModelUsageEntity, (u) => u.user)
  modelUsage!: UserModelUsageEntity[];

  @OneToMany(() => ApiKeyEntity, (k) => k.user)
  apiKeys!: ApiKeyEntity[];
}
