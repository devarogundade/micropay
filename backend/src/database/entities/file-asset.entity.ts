import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'FileAsset' })
export class FileAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  walletAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar' })
  bucket!: string;

  @Index()
  @Column({ type: 'varchar' })
  key!: string;

  @Column({ type: 'varchar', nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'int', nullable: true })
  sizeBytes!: number | null;

  @Column({ type: 'varchar', nullable: true })
  originalName!: string | null;

  /** s3 | supabase */
  @Column({ type: 'varchar', default: 's3' })
  provider!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
