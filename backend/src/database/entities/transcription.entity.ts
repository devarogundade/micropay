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

@Entity({ name: 'Transcription' })
export class TranscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => UserEntity, (u) => u.transcriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar' })
  modelSlug!: string;

  @Column({ type: 'varchar', nullable: true })
  modelName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  filename!: string | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize!: number | null;

  @Column({ type: 'varchar', nullable: true })
  language!: string | null;

  @Column({ type: 'text' })
  text!: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
