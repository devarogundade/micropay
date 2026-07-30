import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UsageKind {
  api = 'api',
  ai = 'ai',
  storage = 'storage',
  payment = 'payment',
}

/** Cross-product usage tracking (API hits, AI tokens, cost). */
@Entity({ name: 'UsageRecord' })
export class UsageRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  kind!: UsageKind;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  walletAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  /** app | code */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  product!: string | null;

  @Column({ type: 'varchar', nullable: true })
  method!: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  endpoint!: string | null;

  @Column({ type: 'int', nullable: true })
  statusCode!: number | null;

  @Column({ type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'varchar', nullable: true })
  model!: string | null;

  @Column({ type: 'int', nullable: true })
  tokensIn!: number | null;

  @Column({ type: 'int', nullable: true })
  tokensOut!: number | null;

  @Column({ type: 'float', nullable: true })
  costUsdc!: number | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  network!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
