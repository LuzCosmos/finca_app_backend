/**
 * Semilla idempotente para tests E2E: tenant con permisos SYS_ADMIN + usuario de login.
 * Opcional: usuario **MANAGER** (`E2E_LIMITED_*`) sin módulo FARM para E2E **403**.
 *
 * Prioridad de env: carga `.env` y luego `test/.env.e2e` (override), igual que Jest E2E.
 * Requiere Postgres con migraciones aplicadas (o `migrationsRun: true` al arrancar Nest) y Redis accesible.
 */
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import type { DataSource } from 'typeorm';

const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
const e2eEnvPath = path.join(root, 'test', '.env.e2e');
if (fs.existsSync(e2eEnvPath)) {
  dotenv.config({ path: e2eEnvPath, override: true });
}

import {
  E2E_LW001_SEED_PROFILE_COLUMN_B_NAME,
  E2E_LW001_SEED_PROFILE_DEFAULT_NAME,
} from './e2e-lw001-seed.constants';

const E2E_LW001_SEED_PROFILE_SPECS = [
  {
    name: E2E_LW001_SEED_PROFILE_DEFAULT_NAME,
    description: 'Perfil por defecto import LW001 (herencia appKey/nwkKey con letra e en hex)',
    csJoineui: '1234568b9d55e072',
    csAppKey: '123456727a5c8160f8d2a1943eb7c65f',
    csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
  },
  {
    name: E2E_LW001_SEED_PROFILE_COLUMN_B_NAME,
    description: 'Perfil columna B import LW001 (herencia appKey con letra e en hex)',
    csJoineui: 'f1a4c38b9d88e072',
    csAppKey: 'd4e9f3b27a5c8160f8d2a1943eb7c65f',
    csNwkKey: '00000000000000000000000000000000',
  },
] as const;

async function ensureE2eLw001DeviceProfiles(
  dataSource: DataSource,
  tenantId: string,
): Promise<void> {
  const { DeviceProfile } = await import('../src/modules/production-center/entities/device-profile.entity');
  const repo = dataSource.getRepository(DeviceProfile);
  const idChipstack =
    process.env.E2E_CHIRPSTACK_DEVICE_PROFILE_ID?.trim() || randomUUID();
  const csApplicationId =
    process.env.E2E_CHIRPSTACK_APPLICATION_ID?.trim() || randomUUID();
  const now = new Date();

  for (const spec of E2E_LW001_SEED_PROFILE_SPECS) {
    let profile = await repo.findOne({ where: { idTenant: tenantId, name: spec.name } });
    if (profile) {
      profile.description = spec.description;
      profile.csJoineui = spec.csJoineui;
      profile.csAppKey = spec.csAppKey;
      profile.csNwkKey = spec.csNwkKey;
      profile.updatedAt = now;
      await repo.save(profile);
    } else {
      profile = repo.create({
        idTenant: tenantId,
        name: spec.name,
        description: spec.description,
        idChipstack,
        csApplicationId,
        csJoineui: spec.csJoineui,
        csAppKey: spec.csAppKey,
        csNwkKey: spec.csNwkKey,
        fccId: 'E2E-FCC-LW001',
        regions: 'US915',
        model: 'LW001-BG PRO',
        input: 'default',
        createdAt: now,
        updatedAt: now,
      });
      await repo.save(profile);
    }
    console.log(`seed:e2e: perfil LW001 "${spec.name}" → id=${profile.id}`);
  }
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
      await ensureE2eLw001DeviceProfiles(dataSource, tenantId);
    }
  } finally {
    await Promise.race([
      app.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((err) => {
      console.error('seed:e2e:', err);
      process.exit(1);
    });
}
