import { MigrationInterface, QueryRunner } from 'typeorm';

export class TruncateTenantsAndUsers1710000000002 implements MigrationInterface {
  name = 'TruncateTenantsAndUsers1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // This migration cannot be reverted
    console.warn('Warning: This migration Truncate tables users and tenants.');
    // Delete the admin user
    await queryRunner.query(`TRUNCATE TABLE "users" CASCADE`);
    
    // Delete the default tenant
    await queryRunner.query(`TRUNCATE TABLE "tenants" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration cannot be reverted
    console.warn('Warning: This migration cannot be reverted. The admin user and default tenant have been deleted.');
  }
}
