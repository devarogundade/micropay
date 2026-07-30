import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ToolExecution, ToolScope } from '../../common/types/enums';

/** Tool definitions for IDE agent / AI orchestration. */
@Entity({ name: 'ToolDef' })
export class ToolDefEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  /** JSON Schema for tool parameters. */
  @Column({ type: 'jsonb' })
  parameters!: Record<string, unknown>;

  /** ide | chat | admin */
  @Index()
  @Column({ type: 'varchar', default: ToolScope.ide })
  scope!: ToolScope | string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** client | server — where the tool executes */
  @Column({ type: 'varchar', default: ToolExecution.client })
  execution!: ToolExecution | string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
