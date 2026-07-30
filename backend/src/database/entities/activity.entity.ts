import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import {
  ActivityKind,
  ActivityStatus,
} from '../../common/types/enums';

export { ActivityStatus, ActivityKind };

@Entity({ name: 'Activity' })
export class ActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, (u) => u.activities, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  walletAddress!: string | null;

  @Column({ type: 'varchar' })
  modelSlug!: string;

  @Column({ type: 'varchar' })
  modelName!: string;

  @Index()
  @Column({ type: 'varchar' })
  type!: ActivityKind | string;

  @Column({ type: 'float' })
  costUsdc!: number;

  @Index()
  @Column({ type: 'varchar' })
  status!: ActivityStatus;

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
