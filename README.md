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

`srv/develop-srv/docker-data/fa-database`

`/srv/develop-srv/docker-data/fa-redis`

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
sudo mkdir -p /srv/develop-srv/docker-data/fa-database,fa-redis,fa-uploads
sudo chown -R develop_user:develop_user /srv/develop-srv/docker-data/fa-database,fa-redis,fa-uploads
```

### 2. Build and Start Backend Services

```bash
cd finca_app_backend
docker-compose build
docker-compose up -d
```

This will start PostgreSQL, Redis, and the Backend API.