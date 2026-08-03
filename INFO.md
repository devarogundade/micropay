# Micropay Submission

## Project name

Micropay

## Project one-liner

Pay-per-use AI and Algorand developer tools with instant USDC micropayments through x402 on Algorand.

## Project Description

Micropay removes subscriptions, prepaid credits, and provider API keys from AI access. Users and agents connect an Algorand wallet and pay only for the individual resource they request, including chat completions, image generation, audio transcription, and Algorand TypeScript IDE assistance.

Each paid API route uses x402 exact payments in USDC on Algorand Mainnet. Unpaid requests receive an HTTP 402 challenge, the client signs the payment with its wallet, and the GoPlausible facilitator verifies and settles the transaction before Micropay returns the requested result. Every route shares one merchant payTo address, publishes Bazaar discovery metadata, and includes the `x402-global-challenge` tag.

Micropay also provides model and endpoint discovery through MCP, persisted image and activity history, PDF and text attachments for AI conversations, and real Puya compilation for Algorand TypeScript contracts. This gives both people and autonomous agents a discoverable, wallet-native way to purchase useful AI and developer capabilities without accounts or monthly commitments.
