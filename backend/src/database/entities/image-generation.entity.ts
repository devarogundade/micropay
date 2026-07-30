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

@Entity({ name: 'ImageGeneration' })
export class ImageGenerationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => UserEntity, (u) => u.imageGenerations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar' })
  modelSlug!: string;

  @Column({ type: 'varchar', nullable: true })
  modelName!: string | null;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'varchar', nullable: true })
  size!: string | null;

  @Column({ type: 'varchar' })
  url!: string;

  @Column({ type: 'varchar', nullable: true })
  storagePath!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
