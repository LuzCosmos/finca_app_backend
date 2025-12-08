import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContextToCattleWeightHistory1710000000014 implements MigrationInterface {
    name = 'AddContextToCattleWeightHistory1710000000014'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create WeightContext enum
        await queryRunner.query(`CREATE TYPE "public"."weight_context_enum" AS ENUM('SALE', 'PURCHASE', 'EVENT', 'MANUAL')`);

        // Add context column to cattle_weight_history
        await queryRunner.query(`ALTER TABLE "cattle_weight_history" ADD "context" "public"."weight_context_enum" NOT NULL DEFAULT 'EVENT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove context column
        await queryRunner.query(`ALTER TABLE "cattle_weight_history" DROP COLUMN "context"`);

        // Drop enum
        await queryRunner.query(`DROP TYPE "public"."weight_context_enum"`);
    }
}
