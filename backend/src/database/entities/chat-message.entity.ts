import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatSessionEntity } from './chat-session.entity';

@Entity({ name: 'ChatMessage' })
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  sessionId!: string;

  @ManyToOne(() => ChatSessionEntity, (s) => s.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session!: ChatSessionEntity;

  @Column({ type: 'varchar' })
  role!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments!: Record<string, unknown>[] | null;

  @Column({ type: 'text', nullable: true })
  reasoning!: string | null;

  @Column({ type: 'varchar', nullable: true })
  modelId!: string | null;

  @Column({ type: 'float', nullable: true })
  costUsdc!: number | null;

  @Column({ type: 'varchar', nullable: true })
  provider!: string | null;

  @Column({ type: 'boolean', default: false })
  error!: boolean;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
