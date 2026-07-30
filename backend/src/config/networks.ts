export type NetworkMode = 'testnet' | 'mainnet';

export const ALGORAND_USDC = {
  mainnet: { asaId: '31566704' },
  testnet: { asaId: '10458941' },
} as const;

export const ZG_ROUTER_DEFAULTS = {
  mainnet: 'https://router-api.0g.ai/v1',
  testnet: 'https://router-api-testnet.integratenetwork.work/v1',
} as const;

export const GOPLAUSIBLE_FACILITATOR_URL =
  'https://facilitator.goplausible.xyz';

/** GoPlausible fee payer (Mainnet + Testnet). */
export const GOPLAUSIBLE_FEE_PAYER =
  'ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA';

export const X402_CHALLENGE_TAG = 'x402-global-challenge';

export function resolveNetwork(raw?: string): NetworkMode {
  return raw?.trim().toLowerCase() === 'testnet' ? 'testnet' : 'mainnet';
}
