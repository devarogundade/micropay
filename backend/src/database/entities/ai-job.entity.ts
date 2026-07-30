import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AiJobStatus, AiJobType } from '../../common/types/enums';
import { PaymentProduct } from '../../common/types/enums';

export { AiJobStatus, AiJobType };

@Entity({ name: 'AiJob' })
export class AiJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  type!: AiJobType;

  @Index()
  @Column({ type: 'varchar', default: AiJobStatus.queued })
  status!: AiJobStatus;

  @Column({ type: 'varchar', nullable: true })
  walletAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  product!: PaymentProduct | string | null;

  @Column({ type: 'varchar', nullable: true })
  model!: string | null;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ type: 'varchar', nullable: true })
  message!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  input!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  result!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bullJobId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
