import {
  GOPLAUSIBLE_FACILITATOR_URL,
  GOPLAUSIBLE_FEE_PAYER,
  ZG_ROUTER_DEFAULTS,
  resolveNetwork,
  type NetworkMode,
} from './networks';

function truthy(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export default () => {
  const network = resolveNetwork(process.env.NETWORK);
  const zgNetwork = resolveNetwork(
    process.env.ZG_ROUTER_NETWORK ?? process.env.NETWORK,
  );
  const x402Network = resolveNetwork(
    process.env.X402_NETWORK ?? process.env.NETWORK,
  );

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),
    network: network as NetworkMode,
    publicApiUrl: (process.env.PUBLIC_API_URL || 'https://api.micropay.website').replace(
      /\/$/,
      '',
    ),

    database: {
      url: process.env.DATABASE_URL,
      sync: truthy(process.env.DATABASE_SYNC, false),
      logging: truthy(process.env.DATABASE_LOGGING, false),
    },

    redis: {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB ?? '0', 10),
    },

    s3: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
      bucket: process.env.AWS_S3_BUCKET || undefined,
      endpoint: process.env.AWS_S3_ENDPOINT || undefined,
      publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL || undefined,
    },

    supabase: {
      url: process.env.SUPABASE_URL || undefined,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
      bucket: process.env.SUPABASE_STORAGE_BUCKET || 'micropay',
    },

    zgRouter: {
      network: zgNetwork as NetworkMode,
      baseUrl:
        process.env.ZG_ROUTER_BASE_URL?.replace(/\/$/, '') ||
        ZG_ROUTER_DEFAULTS[zgNetwork],
      apiKey: process.env.ZG_ROUTER_API_KEY || undefined,
      managementKey: process.env.ZG_ROUTER_MANAGEMENT_KEY || undefined,
    },

    x402: {
      network: x402Network as NetworkMode,
      /** Single merchant address for app + code products. */
      payTo: process.env.X402_PAY_TO || undefined,
      resourceBaseUrl: (process.env.PUBLIC_API_URL || 'https://api.micropay.website').replace(/\/$/, ''),
      facilitatorUrl: GOPLAUSIBLE_FACILITATOR_URL,
      feePayer: process.env.X402_FEE_PAYER || GOPLAUSIBLE_FEE_PAYER,
    },

    /** Per-request USDC when a model/template has no PricingRule override. */
    pricing: {
      defaultAmount: parseFloat(process.env.DEFAULT_AMOUNT ?? '0.01'),
    },

    tools: {
      enabled: truthy(process.env.TOOLS_ENABLED, true),
      maxRounds: parseInt(process.env.TOOLS_MAX_ROUNDS ?? '4', 10),
      webSearch: {
        enabled: truthy(process.env.TOOLS_WEB_SEARCH_ENABLED, true),
        tavilyApiKey: process.env.TAVILY_API_KEY || undefined,
      },
      pdfExtract: {
        enabled: truthy(process.env.TOOLS_PDF_EXTRACT_ENABLED, true),
      },
      fetchUrl: {
        enabled: truthy(process.env.TOOLS_FETCH_URL_ENABLED, true),
      },
      knowledgeSearch: {
        enabled: truthy(process.env.TOOLS_KNOWLEDGE_SEARCH_ENABLED, true),
      },
      currentTime: {
        enabled: truthy(process.env.TOOLS_CURRENT_TIME_ENABLED, true),
      },
      jsonExtract: {
        enabled: truthy(process.env.TOOLS_JSON_EXTRACT_ENABLED, true),
      },
    },

    cors: {
      origins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      appUrl: process.env.PUBLIC_APP_URL,
      codeUrl: process.env.PUBLIC_CODE_URL,
      siteUrl: process.env.PUBLIC_SITE_URL,
    },

    ws: {
      corsOrigin: process.env.WS_CORS_ORIGIN || '*',
    },

    admin: {
      apiKey: process.env.ADMIN_API_KEY || undefined,
    },
  };
};

export type AppConfig = ReturnType<typeof import('./configuration').default>;
