import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgentStatus, AgentType } from '../../common/types/enums';

export { AgentStatus, AgentType };

/** Knowledge base entry injected into an agent's system prompt. */
export type AgentKnowledgeEntry = {
  title: string;
  content: string;
};

/** User-created, shareable AI agent (knowledge base + model + pricing). */
@Entity({ name: 'Agent' })
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Shareable slug used in /agents/:slug links. */
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  slug!: string;

  @Index()
  @Column({ type: 'varchar' })
  creatorAddress!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'varchar', default: AgentType.chat })
  type!: AgentType | string;

  /** Underlying router model id (chat/image/audio per type). */
  @Column({ type: 'varchar' })
  modelId!: string;

  /** Per-use price in USDC charged to the buyer (credited to creator). */
  @Column({ type: 'float' })
  priceUsdc!: number;

  /** Avatar image URL (stored via storage upload). */
  @Column({ type: 'varchar', nullable: true })
  imageUrl!: string | null;

  /** Optional persona / base instructions. */
  @Column({ type: 'text', nullable: true })
  systemPrompt!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  knowledge!: AgentKnowledgeEntry[] | null;

  @Index()
  @Column({ type: 'varchar', default: AgentStatus.published })
  status!: AgentStatus | string;

  @Column({ type: 'int', default: 0 })
  useCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}