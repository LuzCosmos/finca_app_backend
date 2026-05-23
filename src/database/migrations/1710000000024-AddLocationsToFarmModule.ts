import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocationsToFarmModule1710000000024 implements MigrationInterface {
  name = 'AddLocationsToFarmModule1710000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE modules SET access_details = '{"brands":"CRUDL","cattle":"CRUDL","locations":"CRUDL"}' WHERE code = 'FARM'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE modules SET access_details = '{"brands":"CRUDL","cattle":"CRUDL"}' WHERE code = 'FARM'`,
    );
  }
}

