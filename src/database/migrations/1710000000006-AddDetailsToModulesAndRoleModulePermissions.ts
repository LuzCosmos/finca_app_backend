import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDetailsToModulesAndRoleModulePermissions1710000000006 implements MigrationInterface {
  name = 'AddDetailsToModulesAndRoleModulePermissions1710000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the 'code' column to the 'modules' table
    await queryRunner.addColumn('modules', new TableColumn({
      name: 'code',
      type: 'varchar',
      length: '20',
      isNullable: true
    }));
    // Add the 'access_details' column to the 'modules' table
    await queryRunner.addColumn('modules', new TableColumn({
      name: 'access_details',
      type: 'jsonb',
      isNullable: true
    }));
    // Add the 'code' column to the 'roles' table
    await queryRunner.addColumn('roles', new TableColumn({
      name: 'code',
      type: 'varchar',
      length: '20',
      isNullable: true
    }));
    // Add the 'can_list' column to the 'role_module_permissions' table
    await queryRunner.addColumn('role_module_permissions', new TableColumn({
      name: 'can_list',
      type: 'boolean',
      isNullable: false, 
      default: true
    }));
    // Add the 'active' column to the 'users' table
    await queryRunner.addColumn('users', new TableColumn({
      name: 'active',
      type: 'boolean',
      isNullable: false,
      default: true
    }));
    // Change default value for 'can_list'
    await queryRunner.query(`
      ALTER TABLE role_module_permissions ALTER COLUMN can_list SET DEFAULT false;
    `);
    await queryRunner.query(`
      UPDATE modules SET code = 'ACC' WHERE name = 'Accountant';
    `);
    await queryRunner.query(`
      UPDATE modules SET code = 'EMP_MGMT',
       access_details = '{"tenants":"CRUD0", "users":"CRUDL", "roles":"0R00L",  "modules":"0R00L", "permissions":"CRUDL"}'::jsonb 
       WHERE name = 'Employee Management';
    `);
    await queryRunner.query(`
      UPDATE modules SET code = 'EMP_WRK_MGMT' WHERE name = 'Employee Work Management';
    `);
    await queryRunner.query(`
      UPDATE modules SET code = 'FARM' WHERE name = 'Farm';
    `);
    await queryRunner.query(`
      UPDATE modules SET code = 'PROD_CENTER' WHERE name = 'Production Center';
    `);
    // Set 'code' column as NOT NULL
    await queryRunner.query(`
      ALTER TABLE modules ALTER COLUMN code SET NOT NULL;
    `);
    //Roles code
    await queryRunner.query(`
      UPDATE roles SET code = 'SYS_ADMIN' WHERE name = 'System Admin IT';
    `);
    await queryRunner.query(`
      UPDATE roles SET code = 'MANAGER' WHERE name = 'Manager';
    `);
    await queryRunner.query(`
      UPDATE roles SET code = 'ACCOUNTANT' WHERE name = 'Accountant';
    `);
    await queryRunner.query(`
      UPDATE roles SET code = 'FARM_WORKER' WHERE name = 'Farm Worker';
    `);
     // Set 'code' column as NOT NULL for roles
     await queryRunner.query(`
      ALTER TABLE roles ALTER COLUMN code SET NOT NULL;
    `);
    // Delete constraint 'role_model_permissions_role_module_tenant_key'
    await queryRunner.query(`
      ALTER TABLE public.role_module_permissions 
      DROP CONSTRAINT role_model_permissions_role_module_tenant_key;
    `);
    // Add constraint 'role_module_permissions_tenat_role_module_uniq' (efficient way)
    await queryRunner.query(`
      ALTER TABLE public.role_module_permissions 
      ADD CONSTRAINT role_module_permissions_tenat_role_module_uniq 
      UNIQUE (tenant_id, id_role, id_module);
    `);
    //user_roles table
    await queryRunner.query(`ALTER TABLE user_roles DROP CONSTRAINT user_roles_pkey`);
    await queryRunner.query(`ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_role_key`);
    await queryRunner.query(`ALTER TABLE user_roles DROP COLUMN id`);
    await queryRunner.query(`ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id_user, id_role)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the 'code' column from the 'modules' table
    await queryRunner.dropColumn('modules', 'code');
    // Remove the 'access_details' column from the 'modules' table
    await queryRunner.dropColumn('modules', 'access_details');
    // Remove the 'code' column from the 'roles' table
    await queryRunner.dropColumn('roles', 'code');
    // Remove the 'can_list' column from the 'role_module_permissions' table
    await queryRunner.dropColumn('role_module_permissions', 'can_list');
    // Remove the 'active' column from the 'users' table
    await queryRunner.dropColumn('users', 'active');  
    // Delete constraint 'role_module_permissions_tenat_role_module_uniq'
    await queryRunner.query(`
      ALTER TABLE public.role_module_permissions 
      DROP CONSTRAINT role_module_permissions_tenat_role_module_uniq;
    `);   
    // Add constraint 'role_model_permissions_role_module_tenant_key'
    await queryRunner.query(`
      ALTER TABLE public.role_module_permissions 
      ADD CONSTRAINT role_model_permissions_role_module_tenant_key 
      UNIQUE (id_role, id_module, tenant_id);
    `);
    //user_roles table
    await queryRunner.query(`ALTER TABLE user_roles DROP CONSTRAINT user_roles_pkey`);
    await queryRunner.query(`ALTER TABLE user_roles ADD COLUMN id UUID DEFAULT uuid_generate_v4() NOT NULL`);
    await queryRunner.query(`ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_role_key UNIQUE (id_user, id_role)`);
  }
}
