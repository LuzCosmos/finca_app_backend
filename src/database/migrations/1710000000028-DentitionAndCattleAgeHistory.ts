import { MigrationInterface, QueryRunner } from 'typeorm';

export class DentitionAndCattleAgeHistory1710000000028 implements MigrationInterface {
  name = 'DentitionAndCattleAgeHistory1710000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."birth_date_aprx_source_enum" AS ENUM ('MANUAL', 'DENTITION');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD COLUMN IF NOT EXISTS "milk_teeth_count" integer;
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD COLUMN IF NOT EXISTS "permanent_teeth_count" integer;
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD COLUMN IF NOT EXISTS "milk_teeth_wear" smallint;
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD COLUMN IF NOT EXISTS "permanent_teeth_wear" smallint;
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD COLUMN IF NOT EXISTS "dental_evaluation_date" date;
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD COLUMN IF NOT EXISTS "dentition_table_version" varchar(32);
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD COLUMN IF NOT EXISTS "birth_date_aprx_source" "public"."birth_date_aprx_source_enum";
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cattle_age_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "id_tenant" uuid NOT NULL,
        "id_cattle" uuid NOT NULL,
        "source" "public"."birth_date_aprx_source_enum" NOT NULL,
        "milk_teeth_count" integer,
        "permanent_teeth_count" integer,
        "milk_wear" smallint,
        "permanent_wear" smallint,
        "dental_evaluation_date" date,
        "birth_date_aprx_result" date,
        "dentition_table_version" varchar(32),
        "recorded_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cattle_age_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cattle_age_history_cattle" FOREIGN KEY ("id_cattle") REFERENCES "cattle"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cattle_age_history_cattle" ON "cattle_age_history" ("id_cattle");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cattle_age_history_tenant" ON "cattle_age_history" ("id_tenant");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cattle_age_history";`);
    await queryRunner.query(`
      ALTER TABLE "cattle" DROP COLUMN IF EXISTS "birth_date_aprx_source";
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle" DROP COLUMN IF EXISTS "dentition_table_version";
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle" DROP COLUMN IF EXISTS "dental_evaluation_date";
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle" DROP COLUMN IF EXISTS "permanent_teeth_wear";
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle" DROP COLUMN IF EXISTS "milk_teeth_wear";
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle" DROP COLUMN IF EXISTS "permanent_teeth_count";
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle" DROP COLUMN IF EXISTS "milk_teeth_count";
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."birth_date_aprx_source_enum";
    `);
  }
}
