import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CodeUserEntity } from './code-user.entity';

@Entity({ name: 'CodeUserModelUsage' })
@Unique(['userId', 'modelSlug'])
export class CodeUserModelUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => CodeUserEntity, (u) => u.modelUsage, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: CodeUserEntity;

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
