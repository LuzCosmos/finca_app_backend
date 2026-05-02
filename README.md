# Finca App

## 1. Before starting Docker Compose:

### 1.1. Run Chirpstack:

- Download Chirpstack repository for FincaApp, read its README.md file and follow the instructions.

- Generate Chisrpstack Api Keys, for `CHIRPSTACK_API_KEY` in finca app .env file.

### 1.2. Create `.env` file:

make sure to create the `.env` file using the configuration provided in `.example.env`.

### 1.3. Database and Redis Data Path Setup

The server must have the following path:

`${BASE_PATH}/${ENVIRONMENT}-srv/docker-data/fa-database`

`${BASE_PATH}/${ENVIRONMENT}-srv/docker-data/fa-redis`

The `${BASE_PATH}` and `${ENVIRONMENT}` variables are defined in the `.env` file.

**Example:**

`srv/production-srv/docker-data/fa-database`

`/srv/production-srv/docker-data/fa-redis`

`/srv/production-srv/docker-data/fa-uploads`

**Create the path**

Replace `$ENV_USER` with the username for that environment.

> **Note:** $ENV_USER is **NOT** defined in the `.env` file.

Replace `${BASE_PATH}` and `${ENVIRONMENT}` with the value from the `.env` file.

```bash
sudo mkdir -p ${BASE_PATH}/${ENVIRONMENT}-srv/docker-data/{fa-database,fa-redis,fa-uploads}
sudo chown -R $ENV_USER:$ENV_USER ${BASE_PATH}/${ENVIRONMENT}-srv/docker-data/{fa-database,fa-redis,fa-uploads}
```

**Example:**

```bash
sudo mkdir -p /srv/production-srv/docker-data/{fa-database,fa-redis,fa-uploads}
sudo chown -R 100000:100000 /srv/production-srv/docker-data/{fa-database,fa-redis,fa-uploads}
```

### 2. Build and Start Backend Services

```bash
cd finca_app_backend
docker compose build
docker compose up -d
```

This will start PostgreSQL, Redis, and the Backend API.

## 3. Tests E2E (backend)

Desde `finca_app_backend/`, con Postgres y Redis accesibles según tu `.env` / `test/.env.e2e`:

```bash
npm run seed:e2e   # idempotente: crea tenant/usuario E2E (+ usuario MANAGER limitado si defines E2E_LIMITED_*)
npm test
npm run test:e2e
npm run test:ci    # unitarios + cobertura v8 y umbral mínimo de líneas (scripts/check-coverage-min.cjs)
```

Detalle, checklist, CI y aislamiento: **`docs/ejecucion_local_de_test.md`** en la raíz del monorepo (`finca_app/docs/…`).
