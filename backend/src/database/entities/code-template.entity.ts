import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CodeTemplateCloneEntity } from './code-template-clone.entity';

@Entity({ name: 'CodeTemplate' })
export class CodeTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  slug!: string;

  @Index()
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Index()
  @Column({ type: 'varchar', default: 'starter' })
  category!: string;

  @Column({ type: 'varchar' })
  projectName!: string;

  @Column({ type: 'varchar' })
  activePath!: string;

  /** Array<{ path: string; content: string }> */
  @Column({ type: 'jsonb' })
  files!: Array<{ path: string; content: string }>;

  @Index()
  @Column({ type: 'int', default: 0 })
  clonedCount!: number;

  @Index()
  @Column({ type: 'boolean', default: false })
  featured!: boolean;

  /** Soft-archive — public list/get exclude when set. */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => CodeTemplateCloneEntity, (c) => c.template)
  clones!: CodeTemplateCloneEntity[];
}
