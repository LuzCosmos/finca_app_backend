import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { hasE2eAuthConfigured } from './e2e/helpers/e2e-auth';

// cwd = raíz del backend al ejecutar `npm run test:e2e` (más fiable que __dirname con ts-jest).
const root = path.resolve(process.cwd());
config({ path: path.join(root, '.env') });

const e2eEnvPath = path.join(root, 'test', '.env.e2e');
if (!fs.existsSync(e2eEnvPath)) {
  console.warn(
    `[e2e] Falta ${e2eEnvPath}. Se usará solo .env; si FA_DB_HOST es un servicio Docker (ej. develop_finca_app_postgres), fuera de Compose verás ENOTFOUND. Copia test/env.e2e.example a test/.env.e2e y define FA_DB_HOST=localhost (o tu IP/puerto).`,
  );
} else {
  config({ path: e2eEnvPath, override: true });
}

if (process.env.E2E_REQUIRE_AUTH === 'true' && !hasE2eAuthConfigured()) {
  throw new Error(
    'E2E_REQUIRE_AUTH=true: defina E2E_USERNAME, E2E_PASSWORD y E2E_COMPANY_USERNAME en test/.env.e2e',
  );
}
