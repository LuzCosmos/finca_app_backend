import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Configuración comercial opcional por tercero (p. ej. peso mínimo de venta para BUYER).
 */
export class AddBusinessPartnerExtraConfig1710000000033 implements MigrationInterface {
  name = 'AddBusinessPartnerExtraConfig1710000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_partners"
      ADD COLUMN IF NOT EXISTS "extra_config" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_partners"
      DROP COLUMN IF EXISTS "extra_config"
    `);
  }
}
