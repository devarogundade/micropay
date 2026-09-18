import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WithdrawalStatus } from '../../common/types/enums';

export { WithdrawalStatus };

/** Creator withdrawal request (min 1 USDC). Payout is admin-processed. */
@Entity({ name: 'WithdrawalRequest' })
export class WithdrawalRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  creatorAddress!: string;

  /** Amount requested, micro-USDC. */
  @Column({ type: 'bigint' })
  amountMicros!: string;

  @Index()
  @Column({ type: 'varchar', default: WithdrawalStatus.pending })
  status!: WithdrawalStatus | string;

  /** USDC destination on Algorand (defaults to creator address). */
  @Column({ type: 'varchar', nullable: true })
  destinationAddress!: string | null;

  /** On-chain payment txId once paid. */
  @Column({ type: 'varchar', nullable: true })
  txId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;
}