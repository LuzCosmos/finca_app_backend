import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddHasHornToCattle1710000000020 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("cattle", new TableColumn({
            name: "has_horn",
            type: "boolean",
            default: false,
            isNullable: false
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("cattle", "has_horn");
    }

}
