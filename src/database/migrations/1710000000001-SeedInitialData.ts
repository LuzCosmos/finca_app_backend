import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedInitialData1710000000001 implements MigrationInterface {
  name = 'SeedInitialData1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tenant inicial
    await queryRunner.query(`
      INSERT INTO "tenants" ("company_username", "status", "name")
      VALUES ('default_tenant', true, 'Default Tenant')
      RETURNING "id"
    `).then(async (result) => {
      const tenantId = result[0].id;

      // Crear roles principales
      const roles = [
        { name: 'System Admin IT', description: 'Administrador del sistema con acceso total' },
        { name: 'Manager', description: 'Gerente con acceso a gestión general' },
        { name: 'Accountant', description: 'Contador con acceso a información financiera' },
        { name: 'Farm Worker', description: 'Trabajador de campo con acceso básico' }
      ];

      for (const role of roles) {
        await queryRunner.query(`
          INSERT INTO "roles" ("name", "description")
          VALUES ($1, $2)
          ${role.name === 'System Admin IT' ? 'RETURNING "id"' : ''}
        `, [role.name, role.description]).then(async (roleResult) => {
          // Crear usuario admin solo para el rol System Admin IT
          if (role.name === 'System Admin IT') {
            const adminRoleId = roleResult[0].id;
            const hashedPassword = await bcrypt.hash('admin', 10);
            
            await queryRunner.query(`
              INSERT INTO "users" (
                "id_tenant",
                "username",
                "id_role",
                "first_name",
                "last_name",
                "pass_word",
                "email"
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              tenantId,
              'admin',
              adminRoleId,
              'System',
              'Administrator',
              hashedPassword,
              'admin@system.com'
            ]);
          }
        });
      }
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar todos los usuarios
    await queryRunner.query(`DELETE FROM "users" WHERE "username" = 'admin'`);
    
    // Eliminar todos los roles
    await queryRunner.query(`DELETE FROM "roles" WHERE "name" IN ('System Admin IT', 'Manager', 'Accountant', 'Farm Worker')`);
    
    // Eliminar el tenant por defecto
    await queryRunner.query(`DELETE FROM "tenants" WHERE "company_username" = 'default_tenant'`);
  }
} 