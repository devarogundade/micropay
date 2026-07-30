import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ChatMessageEntity } from './chat-message.entity';

@Entity({ name: 'ChatSession' })
export class ChatSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => UserEntity, (u) => u.chatSessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar' })
  modelId!: string;

  @Column({ type: 'varchar', nullable: true })
  modelSlug!: string | null;

  @Column({ type: 'varchar', nullable: true })
  title!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ChatMessageEntity, (m) => m.session)
  messages!: ChatMessageEntity[];
}
