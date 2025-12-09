import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCattleForReception1710000000017 implements MigrationInterface {
  name = 'UpdateCattleForReception1710000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.cattle ALTER COLUMN purchased_from DROP NOT NULL;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cattle_id_color;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cattle_id_color ON public.cattle (id_tenant, id_color);`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cattle_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_cattle_tenant_number;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cattle_tenant_sys_number;`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_cattle_tenant_sysnumber ON public.cattle (id_tenant, sys_number)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.cattle ALTER COLUMN purchased_from SET NOT NULL;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cattle_id_color;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cattle_id_color ON public.cattle (id_color);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cattle_status ON public.cattle (status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_cattle_tenant_number ON public.cattle (id_tenant, number);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cattle_tenant_sys_number ON public.cattle (id_tenant, sys_number);`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_cattle_tenant_sysnumber;`);
  }
}