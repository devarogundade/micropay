import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'WalletDailyCredit' })
@Check('"usedMicros" >= 0 AND "reservedMicros" >= 0 AND "usedMicros" + "reservedMicros" <= "allowanceMicros"')
export class WalletDailyCreditEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  walletAddress!: string;

  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ type: 'bigint', default: '100000' })
  allowanceMicros!: string;

  @Column({ type: 'bigint', default: '0' })
  usedMicros!: string;

  @Column({ type: 'bigint', default: '0' })
  reservedMicros!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
