import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'UserModelUsage' })
@Unique(['userId', 'modelSlug'])
export class UserModelUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => UserEntity, (u) => u.modelUsage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar' })
  modelSlug!: string;

  @Column({ type: 'varchar', nullable: true })
  modelName!: string | null;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  lastUsedAt!: Date;

  @Column({ type: 'int', default: 1 })
  useCount!: number;
}
