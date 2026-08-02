import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDailyCredits1722700000000 implements MigrationInterface {
  name = 'AddDailyCredits1722700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "WalletDailyCredit" (
        "walletAddress" varchar(128) NOT NULL,
        "day" date NOT NULL,
        "allowanceMicros" bigint NOT NULL DEFAULT 100000,
        "usedMicros" bigint NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WalletDailyCredit" PRIMARY KEY ("walletAddress", "day"),
        CONSTRAINT "CHK_WalletDailyCredit_used" CHECK ("usedMicros" >= 0 AND "usedMicros" <= "allowanceMicros")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "CreditUsage" (
        "requestId" uuid NOT NULL,
        "walletAddress" varchar(128) NOT NULL,
        "day" date NOT NULL,
        "product" varchar(32) NOT NULL,
        "routeKind" varchar(64) NOT NULL,
        "listPriceMicros" bigint NOT NULL,
        "creditMicros" bigint NOT NULL,
        "chargedMicros" bigint NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_CreditUsage" PRIMARY KEY ("requestId")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_CreditUsage_wallet_day" ON "CreditUsage" ("walletAddress", "day")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "CreditUsage"');
    await queryRunner.query('DROP TABLE IF EXISTS "WalletDailyCredit"');
  }
}
