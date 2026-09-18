import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Creator earnings ledger (integer micro-USDC to avoid float drift). */
@Entity({ name: 'CreatorBalance' })
export class CreatorBalanceEntity {
  @PrimaryColumn({ type: 'varchar' })
  creatorAddress!: string;

  /** Available balance (not yet withdrawn), micro-USDC. */
  @Column({ type: 'bigint', default: '0' })
  balanceMicros!: string;

  /** Lifetime gross earnings, micro-USDC. */
  @Column({ type: 'bigint', default: '0' })
  earnedMicros!: string;

  /** Total withdrawn, micro-USDC. */
  @Column({ type: 'bigint', default: '0' })
  withdrawnMicros!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

export type { CreatorBalanceEntity as CreatorBalance };