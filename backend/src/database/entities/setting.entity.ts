import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Key/value admin settings (feature flags, limits, network configs). */
@Entity({ name: 'Setting' })
export class SettingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: unknown;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  /** Grouping: features | limits | network | models | billing | general */
  @Index()
  @Column({ type: 'varchar', default: 'general' })
  category!: string;

  @Column({ type: 'boolean', default: true })
  public!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
