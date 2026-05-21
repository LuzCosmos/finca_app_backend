import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Una misma res (cattle_id) no puede aparecer en dos detalles del mismo tenant.
 */
export class SaleDetailUniqueCattlePerTenant1710000000031 implements MigrationInterface {
    name = 'SaleDetailUniqueCattlePerTenant1710000000031';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_sale_details_id_tenant_cattle_id" ON "sale_details" ("id_tenant", "cattle_id")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "public"."UQ_sale_details_id_tenant_cattle_id"`,
        );
    }
}
