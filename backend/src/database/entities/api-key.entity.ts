import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'ApiKey' })
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, (u) => u.apiKeys, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity | null;

  @Column({ type: 'varchar' })
  name!: string;

  /** SHA-256 hash of the raw key; raw key shown once at creation. */
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  keyHash!: string;

  @Column({ type: 'varchar', nullable: true })
  prefix!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
