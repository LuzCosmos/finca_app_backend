# finca_app_scale_bridge

Puente local Rice Lake 920i (TCP ASCII) → API Finca App (`POST /hardware/scales/:scaleId/readings`).

No es el backend NestJS ni el frontend Flutter: es un **agente en la red de la finca** que lee la pesa y publica lecturas al backend.

## Desarrollo (Node local)

```bash
cp .env.example .env
# Terminal 1 — simulador
npm install && npm run simulate
# Terminal 2 — bridge
npm run dev
```

`BRIDGE_AUTH_TOKEN` debe coincidir con `SCALE_BRIDGE_AUTH_TOKEN` en `finca_app_backend/.env`.

No configures `TENANT_ID` en el bridge: el tenant lo define el usuario logueado en Finca App al abrir un formulario con el panel de pesa (el frontend llama `POST .../session` con su JWT).

## Docker

### Simulador + bridge (desarrollo)

Con el **backend** ya levantado en el host (en este repo suele ser puerto **23000**, ver `APP_PORT_EXTERNAL` en `finca_app_backend/.env`):

```bash
cp .env.example .env
# Editar BRIDGE_AUTH_TOKEN (debe coincidir con el backend)
docker compose up --build
```

- **scale-simulator**: TCP en puerto `10001` (host y red Docker).
- **scale-bridge**: se conecta a `scale-simulator` y publica en `http://host.docker.internal:23000/api/v1` (ajusta si tu backend usa otro puerto).

### Si ves `Publish error: fetch failed`

1. El backend NestJS **debe estar corriendo** en el host antes del bridge.
2. `BACKEND_BASE_URL` debe usar el puerto **publicado** (`APP_PORT_EXTERNAL`, típicamente `23000`, no `3000` interno del contenedor).
3. En `.env` del bridge: `BRIDGE_AUTH_TOKEN` = `SCALE_BRIDGE_AUTH_TOKEN` del backend.
4. Prueba desde el host: `curl http://localhost:23000/api/v1/health`
5. Reconstruye: `docker compose up --build`

### Solo bridge (pesa real en LAN)

```bash
docker compose up --build scale-bridge
```

En `.env` o variables de entorno:

```env
SCALE_HOST=192.168.x.x   # IP de la pesa 920i
SCALE_PORT=10001
BACKEND_BASE_URL=https://tu-api.ejemplo.com/api/v1
```

### Build manual

```bash
docker build -t finca_app_scale_bridge:latest .
docker run --rm --env-file .env finca_app_scale_bridge:latest
```

## Tests

```bash
npm test
```

## Variables

Ver [`.env.example`](.env.example) y [`finca_app_docs/scale-integration-env-vars.md`](../finca_app_docs/scale-integration-env-vars.md).
