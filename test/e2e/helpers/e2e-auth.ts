import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

/** `E2E_USERNAME`, `E2E_PASSWORD` y `E2E_COMPANY_USERNAME` definidos (no vacíos). */
export function hasE2eAuthConfigured(): boolean {
  const username = process.env.E2E_USERNAME?.trim();
  const password = process.env.E2E_PASSWORD;
  const company_username = process.env.E2E_COMPANY_USERNAME?.trim();
  return !!(username && password && company_username);
}

/** Admin E2E + usuario limitado (MANAGER) para test 403, mismos company / tenant. */
export function hasE2eLimited403Configured(): boolean {
  if (!hasE2eAuthConfigured()) {
    return false;
  }
  const u = process.env.E2E_LIMITED_USERNAME?.trim();
  const p = process.env.E2E_LIMITED_PASSWORD;
  return !!(u && p);
}

export async function loginE2eViaPassword(app: INestApplication<App>): Promise<{
  access_token: string;
  refresh_token: string;
  user: { tenant_id: string; id: string };
}> {
  const username = process.env.E2E_USERNAME?.trim();
  const password = process.env.E2E_PASSWORD;
  const company_username = process.env.E2E_COMPANY_USERNAME?.trim();
  if (!username || !password || !company_username) {
    throw new Error('E2E: definir E2E_USERNAME, E2E_PASSWORD, E2E_COMPANY_USERNAME');
  }

  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    username,
    password,
    company_username,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`E2E login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const access_token = res.body?.access_token;
  const refresh_token = res.body?.refresh_token;
  const user = res.body?.user;
  if (typeof access_token !== 'string' || typeof refresh_token !== 'string') {
    throw new Error('E2E login: respuesta sin tokens');
  }
  if (!user?.tenant_id || !user?.id) {
    throw new Error('E2E login: respuesta sin user.tenant_id o user.id');
  }

  return {
    access_token,
    refresh_token,
    user: { tenant_id: user.tenant_id, id: user.id },
  };
}

/** Login como usuario con rol sin permiso FARM/cattle (p. ej. MANAGER del seed). */
export async function loginE2eLimitedViaPassword(app: INestApplication<App>): Promise<{
  access_token: string;
  refresh_token: string;
  user: { tenant_id: string; id: string };
}> {
  const username = process.env.E2E_LIMITED_USERNAME?.trim();
  const password = process.env.E2E_LIMITED_PASSWORD;
  const company_username = process.env.E2E_COMPANY_USERNAME?.trim();
  if (!username || !password || !company_username) {
    throw new Error('E2E: definir E2E_LIMITED_USERNAME, E2E_LIMITED_PASSWORD y E2E_COMPANY_USERNAME');
  }

  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
    username,
    password,
    company_username,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`E2E login limitado falló (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const access_token = res.body?.access_token;
  const refresh_token = res.body?.refresh_token;
  const user = res.body?.user;
  if (typeof access_token !== 'string' || typeof refresh_token !== 'string') {
    throw new Error('E2E login limitado: respuesta sin tokens');
  }
  if (!user?.tenant_id || !user?.id) {
    throw new Error('E2E login limitado: respuesta sin user.tenant_id o user.id');
  }

  return {
    access_token,
    refresh_token,
    user: { tenant_id: user.tenant_id, id: user.id },
  };
}

/** Bearer + tenant y usuario (vía login en cada llamada que lo use). */
export async function getE2eSessionContext(app: INestApplication<App>): Promise<{
  accessToken: string;
  tenantId: string;
  userId: string;
}> {
  const { access_token, user } = await loginE2eViaPassword(app);
  return { accessToken: access_token, tenantId: user.tenant_id, userId: user.id };
}

/**
 * Token de acceso obtenido con `E2E_USERNAME` + `E2E_PASSWORD` + `E2E_COMPANY_USERNAME`.
 */
export async function resolveE2eAccessToken(app: INestApplication<App>): Promise<string | null> {
  if (!hasE2eAuthConfigured()) {
    return null;
  }
  return (await getE2eSessionContext(app)).accessToken;
}
