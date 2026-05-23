import { MigrationInterface, QueryRunner } from 'typeorm';

export class MassiveEventsNameNotNullBackfill1710000000030 implements MigrationInterface {
  name = 'MassiveEventsNameNotNullBackfill1710000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "massive_events"
      SET "name" = 'MassiveEvent'
      WHERE "name" IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "massive_events"
      ALTER COLUMN "name" SET NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "massive_events"
      ALTER COLUMN "name" DROP NOT NULL;
    `);
  }
}
