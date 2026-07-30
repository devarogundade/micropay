import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  PricingNetworkScope,
  PricingProduct,
} from '../../common/types/enums';

export { PricingProduct, PricingNetworkScope };

/** Admin-managed pricing rules (model floors, clone price, caps). */
@Entity({ name: 'PricingRule' })
export class PricingRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  key!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'varchar', default: PricingProduct.shared })
  product!: PricingProduct;

  /** Optional model slug / route kind matcher. */
  @Column({ type: 'varchar', nullable: true })
  modelSlug!: string | null;

  @Column({ type: 'varchar', nullable: true })
  routeKind!: string | null;

  @Column({ type: 'float' })
  priceUsdc!: number;

  @Column({ type: 'float', nullable: true })
  minUsdc!: number | null;

  @Column({ type: 'float', nullable: true })
  maxUsdc!: number | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** Applies on mainnet | testnet | both */
  @Column({ type: 'varchar', default: PricingNetworkScope.both })
  network!: PricingNetworkScope | string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
