/** Shared domain enums — prefer these over magic strings. */

export enum NetworkMode {
  testnet = 'testnet',
  mainnet = 'mainnet',
}

/** PricingRule.network applicability. */
export enum PricingNetworkScope {
  mainnet = 'mainnet',
  testnet = 'testnet',
  both = 'both',
}

export enum PricingProduct {
  app = 'app',
  code = 'code',
  shared = 'shared',
}

export enum PricingKeyType {
  model = 'model',
  template = 'template',
  custom = 'custom',
}

export enum AiJobStatus {
  queued = 'queued',
  active = 'active',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled',
}

export enum AiJobType {
  process = 'process',
  embed = 'embed',
  chat = 'chat',
  image = 'image',
  audio = 'audio',
  ide_agent = 'ide_agent',
}

/** Upstream inference vendor / gateway. */
export enum ProviderId {
  openai = 'openai',
  anthropic = 'anthropic',
  zg_router = 'zg_router',
}

export enum ActivityStatus {
  settled = 'settled',
  verified = 'verified',
  failed = 'failed',
}

export enum ActivityKind {
  Chat = 'Chat',
  IDE = 'IDE',
  ImageGen = 'Image Gen',
  Audio = 'Audio',
  Clone = 'Clone',
}

export enum PaymentProduct {
  app = 'app',
  code = 'code',
}

export enum RouteKind {
  chat = 'chat',
  images = 'images',
  audio = 'audio',
  ide = 'ide',
  clone = 'clone',
}

export enum ToolName {
  web_search = 'web_search',
  pdf_extract = 'pdf_extract',
  fetch_url = 'fetch_url',
  knowledge_search = 'knowledge_search',
  current_time = 'current_time',
  json_extract = 'json_extract',
}

export enum ToolScope {
  ide = 'ide',
  chat = 'chat',
  admin = 'admin',
  general = 'general',
}

export enum ToolExecution {
  client = 'client',
  server = 'server',
}

export enum ChatRole {
  system = 'system',
  user = 'user',
  assistant = 'assistant',
  tool = 'tool',
}

export enum PriceResolveSource {
  rule = 'rule',
  default = 'default',
}
