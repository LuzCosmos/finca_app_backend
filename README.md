# Finca App

Before starting Docker Compose, make sure to create the `.env` file using the configuration provided in `.example.env`.

## Redis Data Path Setup

The server must have the following path:  
`/${ENVIRONMENT}-srv/docker-data/fa-redis`

The `${ENVIRONMENT}` variable is defined in the `.env` file.

**Example:** `/develop-srv/docker-data/fa-redis`

### Create the path

Replace `$ENV_USER` with the username for that environment.

> **Note:** $ENV_USER is **NOT** defined in the `.env` file.

Replace `${ENVIRONMENT}` with the value from the `.env` file.

```bash
sudo mkdir -p /${ENVIRONMENT}-srv/docker-data/fa-redis
sudo chown -R $ENV_USER:$ENV_USER /${ENVIRONMENT}-srv/docker-data/fa-redis
```

**Example:**

```bash
sudo mkdir -p /develop-srv/docker-data/fa-redis
sudo chown -R develop_user:develop_user /develop-srv/docker-data/fa-redis
```
