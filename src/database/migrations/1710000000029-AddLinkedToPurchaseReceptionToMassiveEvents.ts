import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedToPurchaseReceptionToMassiveEvents1710000000029 implements MigrationInterface {
  name = 'AddLinkedToPurchaseReceptionToMassiveEvents1710000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "massive_events"
      ADD COLUMN IF NOT EXISTS "linked_to_purchase_reception" boolean NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      UPDATE "massive_events" me
      SET "linked_to_purchase_reception" = true
      WHERE EXISTS (
        SELECT 1 FROM "purchase_receptions" pr
        WHERE pr."id_massive_event" = me."id"
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "massive_events"
      DROP COLUMN IF EXISTS "linked_to_purchase_reception";
    `);
  }
}
