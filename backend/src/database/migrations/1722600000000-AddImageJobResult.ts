import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageJobResult1722600000000 implements MigrationInterface {
  name = 'AddImageJobResult1722600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "ImageJob" ADD COLUMN IF NOT EXISTS "result" jsonb',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "ImageJob" DROP COLUMN IF EXISTS "result"',
    );
  }
}
