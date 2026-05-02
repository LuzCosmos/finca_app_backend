/**
 * Semilla idempotente para tests E2E: tenant con permisos SYS_ADMIN + usuario de login.
 * Opcional: usuario **MANAGER** (`E2E_LIMITED_*`) sin módulo FARM para E2E **403**.
 *
 * Prioridad de env: carga `.env` y luego `test/.env.e2e` (override), igual que Jest E2E.
 * Requiere Postgres con migraciones aplicadas (o `migrationsRun: true` al arrancar Nest) y Redis accesible.
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import type { DataSource } from 'typeorm';

const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
const e2eEnvPath = path.join(root, 'test', '.env.e2e');
if (fs.existsSync(e2eEnvPath)) {
  dotenv.config({ path: e2eEnvPath, override: true });
}

async function ensureE2eLimitedManagerUser(
  dataSource: DataSource,
  tenantId: string,
  hash: (pw: string, rounds: number) => Promise<string>,
): Promise<void> {
  const limitedUser = process.env.E2E_LIMITED_USERNAME?.trim();
  const limitedPassword = process.env.E2E_LIMITED_PASSWORD;
  if (!limitedUser || !limitedPassword) {
    return;
  }

  const { User } = await import('../src/modules/employee-management/entities/user.entity');
  const { Role } = await import('../src/modules/employee-management/entities/role.entity');
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);

  const managerRole = await roleRepo.findOne({ where: { code: 'MANAGER' } });
  if (!managerRole) {
    console.warn('seed:e2e: rol MANAGER no encontrado; omitiendo usuario limitado.');
    return;
  }

  const email =
    process.env.E2E_LIMITED_EMAIL?.trim() || `e2e-limited+${limitedUser.replace(/[^a-zA-Z0-9]/g, '')}@example.invalid`;

  let user = await userRepo.findOne({
    where: { tenantId, username: limitedUser },
    relations: ['roles'],
  });

  const pwdHash = await hash(limitedPassword, 10);

  if (user) {
    user.password = pwdHash;
    user.roles = [managerRole];
    await userRepo.save(user);
  } else {
    user = userRepo.create({
      username: limitedUser,
      password: pwdHash,
      email,
      firstName: process.env.E2E_LIMITED_FIRST_NAME?.trim() || 'E2E',
      lastName: process.env.E2E_LIMITED_LAST_NAME?.trim() || 'Limited',
      tenantId,
      roles: [managerRole],
      active: true,
    });
    await userRepo.save(user);
  }
  console.log(
    `seed:e2e: usuario limitado "${limitedUser}" (MANAGER, sin FARM/cattle) listo para tests 403.`,
  );
}

async function main(): Promise<void> {
  const company = process.env.E2E_COMPANY_USERNAME?.trim();
  const username = process.env.E2E_USERNAME?.trim();
  const password = process.env.E2E_PASSWORD;
  if (!company || !username || !password) {
    console.error('seed:e2e: defina E2E_COMPANY_USERNAME, E2E_USERNAME y E2E_PASSWORD');
    process.exit(1);
  }

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { TenantsService } = await import('../src/modules/employee-management/services/tenants.service');
  const { Tenant } = await import('../src/modules/employee-management/entities/tenant.entity');
  const { User } = await import('../src/modules/employee-management/entities/user.entity');
  const { DataSource } = await import('typeorm');
  const bcrypt = await import('bcrypt');
  const hash = bcrypt.hash.bind(bcrypt);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const tenantsService = app.get(TenantsService);
    const dataSource = app.get(DataSource);
    const tenantRepo = dataSource.getRepository(Tenant);
    const userRepo = dataSource.getRepository(User);

    let tenantId: string | null = null;
    const existing = await tenantRepo.findOne({ where: { company_username: company } });

    if (existing) {
      const user = await userRepo.findOne({ where: { tenantId: existing.id, username } });
      if (user) {
        user.password = await hash(password, 10);
        await userRepo.save(user);
        console.log(`seed:e2e: tenant "${company}" ya existía; contraseña de "${username}" sincronizada.`);
      } else {
        console.warn(
          `seed:e2e: tenant "${company}" existe pero no hay usuario "${username}". Corrija datos o elimine el tenant.`,
        );
        process.exitCode = 1;
      }
      tenantId = existing.id;
    } else {
      const tenantName = process.env.E2E_TENANT_NAME?.trim() || `E2E ${company}`;
      const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim() || 'e2e-admin@example.invalid';

      const created = await tenantsService.create({
        name: tenantName,
        company_username: company,
        status: true,
        admin_username: username,
        admin_password: password,
        admin_email: adminEmail,
        admin_first_name: process.env.E2E_ADMIN_FIRST_NAME?.trim() || 'E2E',
        admin_last_name: process.env.E2E_ADMIN_LAST_NAME?.trim() || 'Admin',
      });
      tenantId = created.id;
      console.log(`seed:e2e: creado tenant "${company}" y usuario "${username}" (rol SYS_ADMIN, permisos completos).`);
    }

    if (tenantId) {
      await ensureE2eLimitedManagerUser(dataSource, tenantId, hash);
    }
  } finally {
    await Promise.race([
      app.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);
  }
}

main()
  .then(() => {
    process.exit(process.exitCode ?? 0);
  })
  .catch((err) => {
    console.error('seed:e2e:', err);
    process.exit(1);
  });
