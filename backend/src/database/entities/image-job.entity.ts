import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'ImageJob' })
export class ImageJobEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, (u) => u.imageJobs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity | null;

  @Column({ type: 'varchar', nullable: true })
  walletAddress!: string | null;

  @Column({ type: 'varchar' })
  modelSlug!: string;

  @Column({ type: 'varchar', nullable: true })
  modelName!: string | null;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'varchar', nullable: true })
  size!: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerAddress!: string | null;

  @Index()
  @Column({ type: 'varchar', default: 'queued' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
