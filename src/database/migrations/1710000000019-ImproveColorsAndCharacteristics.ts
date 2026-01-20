import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImproveColorsAndCharacteristics1710000000019 implements MigrationInterface {
  name = 'ImproveColorsAndCharacteristics1710000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    //delete current colors config
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cattle_id_color;`);
    await queryRunner.query(`ALTER TABLE public.cattle DROP COLUMN IF EXISTS id_color;`);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_colors_tenant_name_ci;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.colors;`);
    //delete current characteristics config
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cattle_characteristics_chr;`);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_cattle_characteristics_unique;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.cattle_characteristics;`);

    await queryRunner.query(`DROP INDEX IF EXISTS ux_characteristics_tenant_name_ci;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.characteristics;`);

    //create new colors config
    await queryRunner.query(`CREATE TYPE "colors_enum" AS ENUM (
      'BLACK', 'WHITE', 'BROWN', 'BLACK_BROWN', 'LIGHT_BROWN', 'GREY');
    `);
    await queryRunner.query(`ALTER TABLE public.cattle ADD COLUMN IF NOT EXISTS color colors_enum NOT NULL DEFAULT 'WHITE'`)

    //create new characteristics config
    await queryRunner.query(`CREATE TYPE "characteristics_enum" AS ENUM (
      'BLACK_BELLY', 'WHITE_BELLY', 'BROWN_BELLY', 'LIGHT_BROWN_BELLY', 'GREY_BELLY',
      'BLACK_HEAD', 'WHITE_HEAD', 'BROWN_HEAD', 'LIGHT_BROWN_HEAD', 'GREY_HEAD',
      'BLACK_HALF_HEAD', 'WHITE_HALF_HEAD', 'BROWN_HALF_HEAD', 'LIGHT_BROWN_HALF_HEAD', 'GREY_HALF_HEAD',
      'BLACK_LEGS', 'WHITE_LEGS', 'BROWN_LEGS', 'LIGHT_BROWN_LEGS', 'GREY_LEGS',
      'BLACK_FEET', 'WHITE_FEET', 'BROWN_FEET', 'LIGHT_BROWN_FEET', 'GREY_FEET',
      'BLACK_SPOTS', 'BROWN_SPOTS', 'LIGHT_BROWN_SPOTS', 'GREY_SPOTS',
      'BLACK_PATTERN', 'BROWN_PATTERN'
      );
    `);

    await queryRunner.query(`
       CREATE TABLE IF NOT EXISTS public.cattle_characteristics (
         id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         id_tenant         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
         id_cattle         uuid NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
         characteristic    characteristics_enum NOT NULL,
         created_at        timestamp NOT NULL DEFAULT now()
       );
     `);

    await queryRunner.query(`
       CREATE UNIQUE INDEX IF NOT EXISTS ux_cattle_characteristics_unique
       ON public.cattle_characteristics (id_cattle, characteristic);
     `);
    await queryRunner.query(`
       CREATE INDEX IF NOT EXISTS idx_cattle_characteristics_tenant
       ON public.cattle_characteristics (id_tenant, id_cattle);
     `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    //Colors
    await queryRunner.query(`ALTER TABLE public.cattle DROP COLUMN IF EXISTS color`);
    await queryRunner.query(`DROP TYPE IF EXISTS colors_enum;`);

    await queryRunner.query(`
       CREATE TABLE IF NOT EXISTS public.colors (
         id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         id_tenant  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
         name       varchar(50) NOT NULL,
         is_active  boolean NOT NULL DEFAULT true,
         created_at timestamp NOT NULL DEFAULT now(),
         updated_at timestamp NOT NULL DEFAULT now()
       );
     `);
    await queryRunner.query(`
       CREATE UNIQUE INDEX IF NOT EXISTS ux_colors_tenant_name_ci
       ON public.colors (id_tenant, lower(name));
     `);
    await queryRunner.query(`
       ALTER TABLE public.cattle
       ADD COLUMN IF NOT EXISTS id_color uuid NULL REFERENCES public.colors(id) ON DELETE SET NULL;
     `);

    //Characteristics
    await queryRunner.query(`DROP INDEX IF EXISTS ux_cattle_characteristics_unique;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cattle_characteristics_tenant;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.cattle_characteristics;`);
    await queryRunner.query(`DROP TYPE IF EXISTS characteristics_enum;`);

    await queryRunner.query(`
       CREATE TABLE IF NOT EXISTS public.characteristics (
         id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         id_tenant  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
         name       varchar(100) NOT NULL,
         group_name varchar(50),
         is_active  boolean NOT NULL DEFAULT true,
         created_at timestamp NOT NULL DEFAULT now(),
         updated_at timestamp NOT NULL DEFAULT now()
       );
     `);
    await queryRunner.query(`
       CREATE UNIQUE INDEX IF NOT EXISTS ux_characteristics_tenant_name_ci
       ON public.characteristics (id_tenant, lower(name));
     `);


    await queryRunner.query(`
       CREATE TABLE IF NOT EXISTS public.cattle_characteristics (
         id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         id_tenant         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
         id_cattle         uuid NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
         id_characteristic uuid NOT NULL REFERENCES public.characteristics(id) ON DELETE RESTRICT,
         created_at        timestamp NOT NULL DEFAULT now()
       );
     `);
    await queryRunner.query(`
       CREATE UNIQUE INDEX IF NOT EXISTS ux_cattle_characteristics_unique
       ON public.cattle_characteristics (id_cattle, id_characteristic);
     `);
    await queryRunner.query(`
       CREATE INDEX IF NOT EXISTS idx_cattle_characteristics_chr
       ON public.cattle_characteristics (id_characteristic);
     `);

  }
}