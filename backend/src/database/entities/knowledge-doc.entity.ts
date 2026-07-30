import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ToolScope } from '../../common/types/enums';

/** IDE / AI knowledge base documents (chunkable for embed jobs). */
@Entity({ name: 'KnowledgeDoc' })
export class KnowledgeDocEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  slug!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  /** ide | chat | general */
  @Index()
  @Column({ type: 'varchar', default: ToolScope.ide })
  scope!: ToolScope | string;

  @Column({ type: 'simple-array', nullable: true })
  tags!: string[] | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  embeddingMeta!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
