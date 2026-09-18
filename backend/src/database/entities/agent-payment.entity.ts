import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Per-use purchase ledger for agents — credits the creator's balance. */
@Entity({ name: 'AgentPayment' })
export class AgentPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  agentId!: string;

  @Column({ type: 'varchar' })
  agentSlug!: string;

  @Column({ type: 'varchar', nullable: true })
  agentName!: string | null;

  @Index()
  @Column({ type: 'varchar' })
  buyerAddress!: string;

  @Index()
  @Column({ type: 'varchar' })
  creatorAddress!: string;

  /** List price in USDC. */
  @Column({ type: 'float' })
  priceUsdc!: number;

  /** Free daily credit applied toward this purchase. */
  @Column({ type: 'float', default: 0 })
  creditAppliedUsdc!: number;

  /** Amount actually charged to the buyer (credited to the creator). */
  @Column({ type: 'float' })
  chargeUsdc!: number;

  @Column({ type: 'varchar', nullable: true })
  txId!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}