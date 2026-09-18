import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgents1722900000000 implements MigrationInterface {
  name = 'AddAgents1722900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "Agent" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying NOT NULL,
        "creatorAddress" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "type" character varying NOT NULL DEFAULT 'chat',
        "modelId" character varying NOT NULL,
        "priceUsdc" double precision NOT NULL,
        "imageUrl" character varying,
        "systemPrompt" text,
        "knowledge" jsonb,
        "status" character varying NOT NULL DEFAULT 'published',
        "useCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_Agent_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_Agent_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_Agent_creatorAddress" ON "Agent" ("creatorAddress")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_Agent_type" ON "Agent" ("type")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_Agent_status" ON "Agent" ("status")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "AgentPayment" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "agentId" character varying NOT NULL,
        "agentSlug" character varying NOT NULL,
        "agentName" character varying,
        "buyerAddress" character varying NOT NULL,
        "creatorAddress" character varying NOT NULL,
        "priceUsdc" double precision NOT NULL,
        "creditAppliedUsdc" double precision NOT NULL DEFAULT 0,
        "chargeUsdc" double precision NOT NULL,
        "txId" character varying,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_AgentPayment_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_AgentPayment_agentId" ON "AgentPayment" ("agentId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_AgentPayment_buyerAddress" ON "AgentPayment" ("buyerAddress")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_AgentPayment_creatorAddress" ON "AgentPayment" ("creatorAddress")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_AgentPayment_createdAt" ON "AgentPayment" ("createdAt")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "CreatorBalance" (
        "creatorAddress" character varying NOT NULL,
        "balanceMicros" bigint NOT NULL DEFAULT '0',
        "earnedMicros" bigint NOT NULL DEFAULT '0',
        "withdrawnMicros" bigint NOT NULL DEFAULT '0',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_CreatorBalance_creatorAddress" PRIMARY KEY ("creatorAddress")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creatorAddress" character varying NOT NULL,
        "amountMicros" bigint NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "destinationAddress" character varying,
        "txId" character varying,
        "note" text,
        "requestedAt" timestamptz NOT NULL DEFAULT now(),
        "processedAt" timestamptz,
        CONSTRAINT "PK_WithdrawalRequest_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_WithdrawalRequest_creatorAddress" ON "WithdrawalRequest" ("creatorAddress")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_WithdrawalRequest_status" ON "WithdrawalRequest" ("status")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "WithdrawalRequest"');
    await queryRunner.query('DROP TABLE IF EXISTS "CreatorBalance"');
    await queryRunner.query('DROP TABLE IF EXISTS "AgentPayment"');
    await queryRunner.query('DROP TABLE IF EXISTS "Agent"');
  }
}