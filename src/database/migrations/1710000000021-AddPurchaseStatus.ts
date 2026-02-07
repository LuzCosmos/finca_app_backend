import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPurchaseStatus1710000000021 implements MigrationInterface {
    name = 'AddPurchaseStatus1710000000021'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."purchases_status_enum" AS ENUM('OPEN', 'RECEIVED')`);
        await queryRunner.query(`ALTER TABLE "purchases" ADD "status" "public"."purchases_status_enum" NOT NULL DEFAULT 'OPEN'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchases" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."purchases_status_enum"`);
    }

}
