import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(4000),

  /** Dual-network switch: drives Algorand + 0G defaults when specific overrides are unset. */
  NETWORK: Joi.string().valid('testnet', 'mainnet').default('testnet'),

  DATABASE_URL: Joi.string().required(),
  DATABASE_SYNC: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_SSL: Joi.boolean().truthy('true').falsy('false').optional(),
  DATABASE_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),

  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  AWS_S3_BUCKET: Joi.string().allow('').optional(),
  AWS_S3_ENDPOINT: Joi.string().allow('').optional(),
  AWS_S3_PUBLIC_BASE_URL: Joi.string().allow('').optional(),

  /** Legacy Supabase storage (optional during migration). Prefer S3. */
  SUPABASE_URL: Joi.string().allow('').optional(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').optional(),
  SUPABASE_STORAGE_BUCKET: Joi.string().default('micropay'),

  ZG_ROUTER_NETWORK: Joi.string().valid('testnet', 'mainnet').optional(),
  ZG_ROUTER_BASE_URL: Joi.string().allow('').optional(),
  ZG_ROUTER_API_KEY: Joi.string().allow('').optional(),
  ZG_ROUTER_MANAGEMENT_KEY: Joi.string().allow('').optional(),

  X402_NETWORK: Joi.string().valid('testnet', 'mainnet').optional(),
  /** Single merchant for app + code. */
  X402_PAY_TO: Joi.string().allow('').optional(),
  X402_FEE_PAYER: Joi.string().allow('').optional(),

  /** Fallback USDC charge when a model/template has no admin PricingRule. */
  DEFAULT_AMOUNT: Joi.number().positive().default(0.01),

  /** Chat tool integrations */
  TOOLS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  TOOLS_MAX_ROUNDS: Joi.number().integer().min(1).max(10).default(4),
  TOOLS_WEB_SEARCH_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  TAVILY_API_KEY: Joi.string().allow('').optional(),
  TOOLS_PDF_EXTRACT_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  TOOLS_FETCH_URL_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  TOOLS_KNOWLEDGE_SEARCH_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  TOOLS_CURRENT_TIME_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  TOOLS_JSON_EXTRACT_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  CORS_ALLOWED_ORIGINS: Joi.string().allow('').optional(),
  PUBLIC_APP_URL: Joi.string().allow('').optional(),
  PUBLIC_CODE_URL: Joi.string().allow('').optional(),
  PUBLIC_SITE_URL: Joi.string().allow('').optional(),
  PUBLIC_API_URL: Joi.string().uri({ scheme: ['https'] }).optional(),

  WS_CORS_ORIGIN: Joi.string().allow('').optional(),
  ADMIN_API_KEY: Joi.string().allow('').optional(),
});
