import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CodeTemplateEntity } from './code-template.entity';

@Entity({ name: 'CodeTemplateClone' })
export class CodeTemplateCloneEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  templateId!: string;

  @ManyToOne(() => CodeTemplateEntity, (t) => t.clones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template!: CodeTemplateEntity;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  walletAddress!: string | null;

  @Column({ type: 'varchar' })
  txId!: string;

  @Column({ type: 'float', default: 0.05 })
  costUsdc!: number;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
