import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'CreditUsage' })
@Index(['walletAddress', 'day'])
export class CreditUsageEntity {
  @PrimaryColumn({ type: 'uuid' })
  requestId!: string;

  @Column({ type: 'varchar', length: 128 })
  walletAddress!: string;

  @Column({ type: 'date' })
  day!: string;

  @Column({ type: 'varchar', length: 32 })
  product!: string;

  @Column({ type: 'varchar', length: 64 })
  routeKind!: string;

  @Column({ type: 'bigint' })
  listPriceMicros!: string;

  @Column({ type: 'bigint' })
  creditMicros!: string;

  @Column({ type: 'bigint' })
  chargedMicros!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
