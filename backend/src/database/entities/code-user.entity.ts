import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CodeActivityEntity } from './code-activity.entity';
import { CodeUserModelUsageEntity } from './code-user-model-usage.entity';

/** IDE product wallet-keyed user (Prisma `CodeUser`). */
@Entity({ name: 'CodeUser' })
export class CodeUserEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  address!: string;

  @Column({ type: 'varchar', nullable: true })
  displayName!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => CodeActivityEntity, (a) => a.user)
  activities!: CodeActivityEntity[];

  @OneToMany(() => CodeUserModelUsageEntity, (u) => u.user)
  modelUsage!: CodeUserModelUsageEntity[];
}
