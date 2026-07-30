import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CodeUserEntity } from './code-user.entity';
import { ActivityStatus } from '../../common/types/enums';

/** @deprecated Prefer ActivityStatus from common/types */
export const CodeActivityStatus = ActivityStatus;
export type CodeActivityStatus = ActivityStatus;

@Entity({ name: 'CodeActivity' })
export class CodeActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @ManyToOne(() => CodeUserEntity, (u) => u.activities, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user!: CodeUserEntity | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  walletAddress!: string | null;

  @Column({ type: 'varchar' })
  modelSlug!: string;

  @Column({ type: 'varchar' })
  modelName!: string;

  @Index()
  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'float' })
  costUsdc!: number;

  @Index()
  @Column({ type: 'varchar' })
  status!: CodeActivityStatus;

  @Column({ type: 'varchar' })
  txId!: string;

  @Column({ type: 'varchar', nullable: true })
  requestId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  provider!: string | null;

  @Column({ type: 'int', nullable: true })
  tokensIn!: number | null;

  @Column({ type: 'int', nullable: true })
  tokensOut!: number | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
