import type {
  PriceResolveSource,
  PricingKeyType,
  PricingNetworkScope,
  PricingProduct,
} from './enums';

export type ResolvedPrice = {
  amount: number;
  source: PriceResolveSource;
  keyType?: PricingKeyType;
  key?: string;
};

export type SetPriceInput = {
  priceUsdc: number;
  name?: string;
  description?: string | null;
  product?: PricingProduct;
  routeKind?: string | null;
  minUsdc?: number | null;
  maxUsdc?: number | null;
  network?: PricingNetworkScope | string;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type TemplatePriceView = {
  slug: string;
  templateId?: string;
  priceUsdc: number;
  source: PriceResolveSource;
  ruleId?: string;
};
